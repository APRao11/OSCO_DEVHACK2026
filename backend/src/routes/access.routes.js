import { Router } from 'express';
import { pool } from '../config/db.js';
import { isUuid, requirePatientAuth } from '../middleware/auth.js';
import { recordAudit, recordAuditSafely, requestIp } from '../services/audit.service.js';

/**
 * Patient decisions on doctor access requests (sections 5.4 step 10, 5.6, 8.9).
 *
 *   POST /api/access/:id/approve  -> read-only access for 60 minutes
 *   POST /api/access/:id/deny
 *
 * The patient comes from the login token, never from the request body.
 * A request belonging to another patient is reported as not found.
 */
const router = Router();

export const ACCESS_WINDOW_MINUTES = 60;

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

const publicRequest = (row) => ({
	id: row.id,
	doctorId: row.doctor_id,
	purpose: row.purpose,
	status: row.status,
	approvedAccess: row.approved_access,
	requestedAt: row.requested_at,
	decidedAt: row.decided_at,
});

/**
 * Lock the request and check it can be decided by this patient.
 * @returns {{ request: object } | { error: [number, string, string] }}
 */
const loadPendingRequest = async (client, requestId, patientId) => {
	const { rows } = await client.query(
		`SELECT r.*, (r.expires_at <= statement_timestamp()) AS is_expired, d.verification_status AS doctor_status
		 FROM doctor_access_requests r
		 JOIN doctors d ON d.id = r.doctor_id
		 WHERE r.id = $1 AND r.patient_id = $2
		 FOR UPDATE OF r`,
		[requestId, patientId],
	);
	const request = rows[0];
	if (!request) return { error: [404, 'NOT_FOUND', 'Access request not found.'] };
	if (request.status !== 'pending') {
		return { error: [409, 'ALREADY_DECIDED', `This request has already been ${request.status}.`] };
	}
	if (request.is_expired) return { error: [409, 'REQUEST_EXPIRED', 'This request has expired. The doctor must ask again.'] };
	return { request };
};

const decide = (decision) => async (req, res, next) => {
	const { patientId } = req.auth;
	const requestId = req.params.id;
	if (!isUuid(requestId)) return fail(res, 404, 'NOT_FOUND', 'Access request not found.');

	const action = `access_request.${decision}`;
	const audit = (outcome, extra = {}) => ({
		actorType: 'patient',
		actorId: patientId,
		patientId,
		action,
		resourceType: 'access_request',
		resourceId: requestId,
		outcome,
		ipAddress: requestIp(req),
		...extra,
	});

	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const loaded = await loadPendingRequest(client, requestId, patientId);
		if (loaded.error) {
			await client.query('ROLLBACK');
			const [status, code, message] = loaded.error;
			if (status !== 404) await recordAuditSafely(audit('denied', { details: { reason: code } }));
			return fail(res, status, code, message);
		}
		const { request } = loaded;

		// Only a currently verified doctor can be given access.
		if (decision === 'approve' && request.doctor_status !== 'verified') {
			await client.query('ROLLBACK');
			await recordAuditSafely(audit('denied', { details: { reason: `doctor_${request.doctor_status}` } }));
			return fail(res, 409, 'DOCTOR_NOT_VERIFIED', 'This doctor is no longer verified, so access cannot be approved.');
		}

		const updated = await client.query(
			`UPDATE doctor_access_requests
			 SET status = $3,
			     approved_access = $4,
			     decided_by_patient_id = $2,
			     decided_at = now()
			 WHERE id = $1 AND patient_id = $2
			 RETURNING *`,
			[requestId, patientId, decision === 'approve' ? 'approved' : 'denied', decision === 'approve' ? 'read' : null],
		);

		let session = null;
		if (decision === 'approve') {
			// Read-only, 60 minutes (section 5.6). The database trigger re-checks the approval.
			const inserted = await client.query(
				`INSERT INTO doctor_access_sessions
				   (request_id, patient_id, doctor_id, access_level, approved_by_patient_id, expires_at)
				 VALUES ($1, $2, $3, 'read', $2, now() + make_interval(mins => $4))
				 RETURNING id, access_level, started_at, expires_at`,
				[requestId, patientId, request.doctor_id, ACCESS_WINDOW_MINUTES],
			);
			const row = inserted.rows[0];
			session = { id: row.id, accessLevel: row.access_level, startedAt: row.started_at, expiresAt: row.expires_at };
		}

		await recordAudit(audit('allowed', { details: { doctorId: request.doctor_id, sessionId: session?.id ?? null } }), client);
		await client.query('COMMIT');

		return res.status(200).json({ data: { request: publicRequest(updated.rows[0]), session } });
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		return next(error);
	} finally {
		client.release();
	}
};

router.post('/:id/approve', requirePatientAuth, decide('approve'));
router.post('/:id/deny', requirePatientAuth, decide('deny'));

export default router;
