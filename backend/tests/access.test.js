/**
 * Integration tests for requireVerifiedDoctor and the patient Approve/Deny endpoints.
 * They need a real, migrated PostgreSQL database, because the consent rules
 * are enforced by triggers. Access history cannot be deleted, so use a
 * throwaway database, never the dev one:
 *
 *   TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/osco_test npm test
 *
 * Without TEST_DATABASE_URL the suite is skipped.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const TEST_DB = process.env.TEST_DATABASE_URL;

describe('doctor verification and access decisions', { skip: !TEST_DB && 'set TEST_DATABASE_URL to run' }, () => {
	let pool;
	let server;
	let baseUrl;
	let secret;

	const token = (role, id) =>
		jwt.sign({ role }, secret, { algorithm: 'HS256', subject: id, issuer: 'osco-api', audience: `osco-${role}`, expiresIn: '1h' });

	const call = async (method, path, bearer) => {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	};

	const createPatient = async () => {
		const { rows } = await pool.query(
			`INSERT INTO patients (full_name, email, password_hash) VALUES ('Test Patient', $1, 'x') RETURNING id`,
			[`patient-${randomUUID()}@test.local`],
		);
		return rows[0].id;
	};

	const createDoctor = async (status) => {
		const { rows } = await pool.query(
			`INSERT INTO doctors (full_name, email, password_hash, license_number, verification_status)
			 VALUES ('Dr Test', $1, 'x', $2, $3) RETURNING id`,
			[`doctor-${randomUUID()}@test.local`, `LIC-${randomUUID()}`, status],
		);
		return rows[0].id;
	};

	const createRequest = async (patientId, doctorId) => {
		const { rows } = await pool.query(
			`INSERT INTO doctor_access_requests (patient_id, doctor_id, purpose, requested_access)
			 VALUES ($1, $2, 'consultation', 'read') RETURNING id`,
			[patientId, doctorId],
		);
		return rows[0].id;
	};

	before(async () => {
		process.env.NODE_ENV = 'test';
		process.env.DATABASE_URL = TEST_DB;
		process.env.JWT_SECRET ||= 'integration-test-only-secret-0123456789abcdef';
		secret = process.env.JWT_SECRET;

		const [{ createApp }, db] = await Promise.all([import('../src/server.js'), import('../src/config/db.js')]);
		pool = db.pool;
		server = createApp().listen(0);
		await new Promise((resolve) => server.once('listening', resolve));
		baseUrl = `http://127.0.0.1:${server.address().port}`;
	});

	after(async () => {
		await new Promise((resolve) => server?.close(resolve));
		await pool?.end();
	});

	describe('requireVerifiedDoctor', () => {
		test('lets a verified doctor through', async () => {
			const doctorId = await createDoctor('verified');
			const res = await call('GET', '/api/doctor/me', token('doctor', doctorId));
			assert.equal(res.status, 200);
			assert.equal(res.body.data.doctor.id, doctorId);
		});

		for (const status of ['pending', 'rejected', 'revoked']) {
			test(`refuses a ${status} doctor and logs the denial`, async () => {
				const doctorId = await createDoctor(status);
				const res = await call('GET', '/api/doctor/me', token('doctor', doctorId));
				assert.equal(res.status, 403);
				assert.equal(res.body.error.code, 'DOCTOR_NOT_VERIFIED');
				assert.equal(res.body.error.status, status);
				const audit = await pool.query(
					`SELECT details FROM audit_logs WHERE actor_id = $1 AND action = 'doctor.request_blocked'`,
					[doctorId],
				);
				assert.equal(audit.rows[0].details.outcome, 'denied');
			});
		}

		test('rejects missing tokens, patient tokens and unknown doctors', async () => {
			assert.equal((await call('GET', '/api/doctor/me')).status, 401);
			assert.equal((await call('GET', '/api/doctor/me', token('patient', await createPatient()))).status, 401);
			assert.equal((await call('GET', '/api/doctor/me', token('doctor', randomUUID()))).status, 401);
		});

		test('revocation blocks the doctor on the very next request and ends active access', async () => {
			const patientId = await createPatient();
			const doctorId = await createDoctor('verified');
			const doctorToken = token('doctor', doctorId);
			const requestId = await createRequest(patientId, doctorId);

			const approved = await call('POST', `/api/access/${requestId}/approve`, token('patient', patientId));
			assert.equal(approved.status, 200);
			assert.equal((await call('GET', '/api/doctor/me', doctorToken)).status, 200);

			await pool.query(`UPDATE doctors SET verification_status = 'revoked', revoked_at = now() WHERE id = $1`, [doctorId]);

			// Same, still-valid token: refused straight away.
			const blocked = await call('GET', '/api/doctor/me', doctorToken);
			assert.equal(blocked.status, 403);
			assert.equal(blocked.body.error.status, 'revoked');

			const session = await pool.query('SELECT revoked_at FROM doctor_access_sessions WHERE request_id = $1', [requestId]);
			assert.ok(session.rows[0].revoked_at, 'the trigger should end the active session');
		});
	});

	describe('POST /api/access/:id/approve and /deny', () => {
		test('approve gives read-only access for 60 minutes and writes the audit log', async () => {
			const patientId = await createPatient();
			const doctorId = await createDoctor('verified');
			const requestId = await createRequest(patientId, doctorId);

			const res = await call('POST', `/api/access/${requestId}/approve`, token('patient', patientId));
			assert.equal(res.status, 200);
			assert.equal(res.body.data.request.status, 'approved');
			assert.equal(res.body.data.request.approvedAccess, 'read');
			assert.equal(res.body.data.session.accessLevel, 'read');

			const minutes = (new Date(res.body.data.session.expiresAt) - new Date(res.body.data.session.startedAt)) / 60_000;
			assert.equal(Math.round(minutes), 60);

			const audit = await pool.query(
				`SELECT actor_type, details FROM audit_logs WHERE resource_id = $1 AND action = 'access_request.approve'`,
				[requestId],
			);
			assert.equal(audit.rows[0].actor_type, 'patient');
			assert.equal(audit.rows[0].details.outcome, 'allowed');
		});

		test('deny records the decision and creates no session', async () => {
			const patientId = await createPatient();
			const requestId = await createRequest(patientId, await createDoctor('verified'));

			const res = await call('POST', `/api/access/${requestId}/deny`, token('patient', patientId));
			assert.equal(res.status, 200);
			assert.equal(res.body.data.request.status, 'denied');
			assert.equal(res.body.data.session, null);
			const sessions = await pool.query('SELECT 1 FROM doctor_access_sessions WHERE request_id = $1', [requestId]);
			assert.equal(sessions.rowCount, 0);
		});

		test('a decided request cannot be decided again', async () => {
			const patientId = await createPatient();
			const requestId = await createRequest(patientId, await createDoctor('verified'));
			const patientToken = token('patient', patientId);

			assert.equal((await call('POST', `/api/access/${requestId}/deny`, patientToken)).status, 200);
			const again = await call('POST', `/api/access/${requestId}/approve`, patientToken);
			assert.equal(again.status, 409);
			assert.equal(again.body.error.code, 'ALREADY_DECIDED');
		});

		test("another patient's request is reported as not found", async () => {
			const requestId = await createRequest(await createPatient(), await createDoctor('verified'));
			const res = await call('POST', `/api/access/${requestId}/approve`, token('patient', await createPatient()));
			assert.equal(res.status, 404);
		});

		test('cannot approve a request from a doctor who is no longer verified', async () => {
			const patientId = await createPatient();
			const doctorId = await createDoctor('verified');
			const requestId = await createRequest(patientId, doctorId);
			await pool.query(`UPDATE doctors SET verification_status = 'revoked' WHERE id = $1`, [doctorId]);

			const res = await call('POST', `/api/access/${requestId}/approve`, token('patient', patientId));
			assert.equal(res.status, 409);
			assert.equal(res.body.error.code, 'DOCTOR_NOT_VERIFIED');
		});

		test('rejects bad ids, missing tokens and doctor tokens', async () => {
			const patientToken = token('patient', await createPatient());
			assert.equal((await call('POST', '/api/access/not-a-uuid/approve', patientToken)).status, 404);
			assert.equal((await call('POST', `/api/access/${randomUUID()}/approve`)).status, 401);
			assert.equal((await call('POST', `/api/access/${randomUUID()}/deny`, token('doctor', randomUUID()))).status, 401);
		});
	});
});
