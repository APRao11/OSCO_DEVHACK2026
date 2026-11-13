import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();
const BCRYPT_ROUNDS = 12;
const PASSWORD_MAX_BYTES = 72;
const DUMMY_PASSWORD_HASH = await bcrypt.hash(randomBytes(32).toString('base64url'), BCRYPT_ROUNDS);

const invalidInput = (res, message) =>
	res.status(400).json({ error: { code: 'INVALID_INPUT', message } });

const isEmail = (email) =>
	email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const issuePatientToken = (patientId) =>
	jwt.sign({ role: 'patient' }, env.jwtSecret, {
		algorithm: 'HS256',
		subject: patientId,
		issuer: 'osco-api',
		audience: 'osco-patient',
		expiresIn: '1h',
	});

const publicPatient = (row) => ({
	id: row.id,
	name: row.full_name,
	email: row.email,
	createdAt: row.created_at,
	// The public Patient ID (OSCO-XXXXXXXX) a patient gives a doctor; never the internal UUID.
	publicId: row.public_id,
});

const sessionResponse = (res, status, row) =>
	res.status(status).json({
		data: {
			token: issuePatientToken(row.id),
			patient: publicPatient(row),
		},
	});

router.post('/register', async (req, res, next) => {
	const { name, email, password } = req.body ?? {};
	if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
		return invalidInput(res, 'Name, email, and password are required.');
	}

	const normalizedName = name.trim();
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedName || normalizedName.length > 150) {
		return invalidInput(res, 'Name must be between 1 and 150 characters.');
	}
	if (!isEmail(normalizedEmail)) {
		return invalidInput(res, 'Enter a valid email address.');
	}
	if (password.length < 8 || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
		return invalidInput(res, 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.');
	}

	try {
		const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
		const result = await pool.query(
			`INSERT INTO patients (full_name, email, password_hash)
			 VALUES ($1, $2, $3)
			 RETURNING id, full_name, email, created_at, public_id`,
			[normalizedName, normalizedEmail, passwordHash],
		);
		return sessionResponse(res, 201, result.rows[0]);
	} catch (error) {
		if (error.code === '23505' && error.constraint === 'patients_email_lower_unique') {
			return res.status(409).json({
				error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists.' },
			});
		}
		return next(error);
	}
});

router.post('/login', async (req, res, next) => {
	const { email, password } = req.body ?? {};
	if (typeof email !== 'string' || typeof password !== 'string') {
		return invalidInput(res, 'Email and password are required.');
	}

	const normalizedEmail = email.trim().toLowerCase();
	if (!isEmail(normalizedEmail) || !password.length || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
		return res.status(401).json({
			error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
		});
	}

	try {
		const result = await pool.query(
			`SELECT id, full_name, email, password_hash, created_at, public_id
			 FROM patients
			 WHERE lower(email) = $1
			 LIMIT 1`,
			[normalizedEmail],
		);
		const patient = result.rows[0];
		const passwordMatches = patient
			? await bcrypt.compare(password, patient.password_hash)
			: await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

		if (!patient || !passwordMatches) {
			return res.status(401).json({
				error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' },
			});
		}

		return sessionResponse(res, 200, patient);
	} catch (error) {
		return next(error);
	}
});

export default router;
