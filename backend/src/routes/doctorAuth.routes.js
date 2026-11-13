import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { recordAuditSafely, requestIp } from '../services/audit.service.js';

/**
 * POST /api/auth/doctor/login (MVP document 6.2.1, 8.9).
 *
 * Pending, rejected and revoked doctors can log in and see their status; they
 * are refused on every doctor route by requireVerifiedDoctor, which reads the
 * status from the database on each request. The token carries no status.
 */
const router = Router();
const PASSWORD_MAX_BYTES = 72;
const DUMMY_PASSWORD_HASH = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);

const STATUS_MESSAGES = {
	pending: 'Your account is awaiting verification by your hospital.',
	verified: null,
	rejected: 'Your registration was rejected by your hospital.',
	revoked: 'Your verification has been revoked by your hospital.',
};

const issueDoctorToken = (doctorId) =>
	jwt.sign({ role: 'doctor' }, env.jwtSecret, {
		algorithm: 'HS256',
		subject: doctorId,
		issuer: 'osco-api',
		audience: 'osco-doctor',
		expiresIn: '1h',
	});

const invalid = (res) => res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });

router.post('/login', async (req, res, next) => {
	const { email, password } = req.body ?? {};
	if (typeof email !== 'string' || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
		return invalid(res);
	}
	try {
		const { rows } = await pool.query(
			'SELECT id, full_name, email, password_hash, verification_status FROM doctors WHERE lower(email) = $1 LIMIT 1',
			[email.trim().toLowerCase()],
		);
		const doctor = rows[0];
		// Compare against a dummy hash when the account does not exist, so timing does not reveal it.
		const ok = await bcrypt.compare(password, doctor?.password_hash ?? DUMMY_PASSWORD_HASH);
		if (!doctor || !ok) return invalid(res);

		await recordAuditSafely({
			actorType: 'doctor', actorId: doctor.id, action: 'doctor.login', resourceType: 'session',
			outcome: 'allowed', details: { status: doctor.verification_status }, ipAddress: requestIp(req),
		});
		return res.status(200).json({
			data: {
				token: issueDoctorToken(doctor.id),
				doctor: {
					id: doctor.id,
					name: doctor.full_name,
					email: doctor.email,
					verificationStatus: doctor.verification_status,
					statusMessage: STATUS_MESSAGES[doctor.verification_status] ?? null,
				},
			},
		});
	} catch (error) {
		return next(error);
	}
});

export default router;
