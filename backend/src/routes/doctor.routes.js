import { Router } from 'express';
import { pool } from '../config/db.js';
import { isUuid } from '../middleware/auth.js';
import { requirePatientAccess } from '../middleware/patientScope.js';
import { doctorOnly } from '../middleware/requireVerifiedDoctor.js';
import { recordAudit, recordAuditSafely, requestIp } from '../services/audit.service.js';
import { buildPatientRecords } from '../services/records.service.js';
import { ClinicalRecordError, createClinicalRecord } from '../services/clinicalRecords.service.js';
import { verifyFinding } from '../services/findings.service.js';
import { enqueueReconcile } from '../services/queue.service.js';
import { findingReviewHandlers } from './findingReview.js';
import { chatHandler } from './chat.routes.js';

/**
 * Doctor-only routes (MVP document 6.2, 7.1, 8.9). The guard is applied to the
 * whole router, so every route re-checks the doctor's verification status in
 * the database on each request. Patient routes also require the patient's
 * approved, unexpired consent (requirePatientAccess); changes require "edit".
 */
const router = Router();
router.use(...doctorOnly);

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const PUBLIC_ID = /^OSCO-[2-9A-HJ-NP-Z]{8}$/;
const normaliseId = (raw) => (typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '');

/** Confirms the caller is a currently verified doctor. */
router.get('/me', (req, res) => {
	res.status(200).json({ data: { doctor: req.doctor } });
});

/** Patient ID lookup: limited identification only, no medical data (6.2.2). */
router.post('/lookup', async (req, res, next) => {
	const publicId = normaliseId(req.body?.patientId);
	try {
		const { rows } = PUBLIC_ID.test(publicId)
			? await pool.query('SELECT id, public_id, full_name FROM patients WHERE public_id = $1', [publicId])
			: { rows: [] };
		await recordAuditSafely({
			actorType: 'doctor', actorId: req.doctor.id, patientId: rows[0]?.id ?? null, action: 'patient.lookup',
			resourceType: 'patient', resourceId: rows[0]?.id ?? null, outcome: rows.length ? 'allowed' : 'denied',
			details: rows.length ? {} : { reason: 'not_found' }, ipAddress: requestIp(req),
		});
		if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'No patient found with this ID. Check the ID and try again.');
		return res.status(200).json({ data: { patient: { publicId: rows[0].public_id, name: rows[0].full_name } } });
	} catch (error) {
		return next(error);
	}
});

const requestView = (row) => {
	const now = Date.now();
	const sessionActive = row.session_id && !row.session_revoked_at && new Date(row.session_expires_at).getTime() > now;
	let status = row.status;
	if (row.status === 'pending' && new Date(row.expires_at).getTime() <= now) status = 'expired';
	if (row.status === 'approved' && !sessionActive) status = row.session_revoked_at ? 'ended' : 'expired';
	return {
		id: row.id,
		status,
		purpose: row.purpose,
		requestedAccess: row.requested_access,
		approvedAccess: row.approved_access,
		requestedAt: row.requested_at,
		decidedAt: row.decided_at,
		patient: { publicId: row.public_id, name: row.full_name },
		session: row.session_id
			? { accessLevel: row.access_level, startedAt: row.started_at, expiresAt: row.session_expires_at, active: Boolean(sessionActive) }
			: null,
	};
};

const REQUEST_SELECT = `
	SELECT r.*, p.public_id, p.full_name,
	       s.id AS session_id, s.access_level, s.started_at, s.expires_at AS session_expires_at, s.revoked_at AS session_revoked_at
	FROM doctor_access_requests r
	JOIN patients p ON p.id = r.patient_id
	LEFT JOIN doctor_access_sessions s ON s.request_id = r.id`;

/**
 * Ask a patient for access (6.2.2). access: 'read' (view) or 'edit' (view and correct).
 * The patient sees the request on their dashboard and approves or denies it.
 */
router.post('/access-requests', async (req, res, next) => {
	const publicId = normaliseId(req.body?.patientId);
	const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
	const access = req.body?.access ?? 'read';
	if (!PUBLIC_ID.test(publicId)) return fail(res, 404, 'NOT_FOUND', 'No patient found with this ID. Check the ID and try again.');
	if (!purpose || purpose.length > 200) return fail(res, 400, 'INVALID_INPUT', 'Give a short reason for access (200 characters or fewer).');
	if (!['read', 'edit'].includes(access)) return fail(res, 400, 'INVALID_INPUT', 'access must be read or edit.');
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const patient = await client.query('SELECT id FROM patients WHERE public_id = $1', [publicId]);
		if (!patient.rowCount) {
			await client.query('ROLLBACK');
			return fail(res, 404, 'NOT_FOUND', 'No patient found with this ID. Check the ID and try again.');
		}
		const { rows } = await client.query(
			`INSERT INTO doctor_access_requests (patient_id, doctor_id, purpose, requested_access) VALUES ($1, $2, $3, $4) RETURNING id`,
			[patient.rows[0].id, req.doctor.id, purpose, access],
		);
		await recordAudit(
			{
				actorType: 'doctor', actorId: req.doctor.id, patientId: patient.rows[0].id, action: 'access_request.create',
				resourceType: 'access_request', resourceId: rows[0].id, outcome: 'allowed', details: { requestedAccess: access }, ipAddress: requestIp(req),
			},
			client,
		);
		await client.query('COMMIT');
		const created = await pool.query(`${REQUEST_SELECT} WHERE r.id = $1`, [rows[0].id]);
		return res.status(201).json({ data: { request: requestView(created.rows[0]) } });
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		return next(error);
	} finally {
		client.release();
	}
});

/**
 * This doctor's recent requests (last 24 hours), newest first: pending ones to keep
 * waiting on and approved ones with an active session to open. Lets the doctor
 * portal pick up where it left off after a reload or a portal switch.
 */
router.get('/access-requests', async (req, res, next) => {
	try {
		const { rows } = await pool.query(
			`${REQUEST_SELECT} WHERE r.doctor_id = $1 AND r.requested_at > now() - interval '24 hours' ORDER BY r.requested_at DESC LIMIT 20`,
			[req.doctor.id],
		);
		return res.status(200).json({ data: { requests: rows.map(requestView) } });
	} catch (error) {
		return next(error);
	}
});

/** The doctor polls this while waiting for the patient's decision (5.6). Own requests only. */
router.get('/access-requests/:id', async (req, res, next) => {
	if (!isUuid(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Access request not found.');
	try {
		const { rows } = await pool.query(`${REQUEST_SELECT} WHERE r.id = $1 AND r.doctor_id = $2`, [req.params.id, req.doctor.id]);
		if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'Access request not found.');
		return res.status(200).json({ data: { request: requestView(rows[0]) } });
	} catch (error) {
		return next(error);
	}
});

// ------------------------------------------------- the patient's records (consent required)

const scope = { read: requirePatientAccess('read'), edit: requirePatientAccess('edit') };

/** Every patient-record route reports the doctor's current access, so the UI can show it. */
const withAccess = (req, data) => ({ ...data, access: { level: req.patientAccess.accessLevel, expiresAt: req.patientAccess.expiresAt } });

router.get('/patients/:publicId/records', scope.read, async (req, res, next) => {
	try {
		const { publicId, patientId } = req.patientAccess;
		const { pendingReview: _privateToPatient, ...records } = await buildPatientRecords(patientId, {
			fileUrl: (id) => `/api/doctor/patients/${publicId}/documents/${id}/file`,
		});
		await recordAuditSafely({
			actorType: 'doctor', actorId: req.doctor.id, patientId, action: 'patient_record.view', resourceType: 'patient',
			resourceId: patientId, outcome: 'allowed', details: { sessionId: req.patientAccess.sessionId }, ipAddress: requestIp(req),
		});
		return res.status(200).json({ data: withAccess(req, records) });
	} catch (error) {
		return next(error);
	}
});

// Viewing and correcting findings: the same handlers as the patient dashboard, acting as this doctor.
const review = findingReviewHandlers({
	context: (req) => ({ patientId: req.patientAccess.patientId, actor: { type: 'doctor', id: req.doctor.id } }),
	scope: 'doctor',
});

/** Questions about the patient's records, as this doctor, under the patient's consent (6.2.9). */
router.post(
	'/patients/:publicId/chat',
	scope.read,
	chatHandler((req) => ({
		patientId: req.patientAccess.patientId,
		actor: { type: 'doctor', id: req.doctor.id },
		fileUrl: (id) => `/api/doctor/patients/${req.patientAccess.publicId}/documents/${id}/file`,
	})),
);

router.get('/patients/:publicId/documents/:id', scope.read, review.get);
router.get('/patients/:publicId/documents/:id/file', scope.read, review.file);
/** Correct a finding: a new doctor-verified version; the original and its quote stay viewable (6.2.7). */
router.patch('/patients/:publicId/documents/:id/findings/:findingId', scope.edit, review.edit);
/** Remove a finding from the history (kept, never deleted). */
router.post('/patients/:publicId/documents/:id/findings/:findingId/dismiss', scope.edit, review.dismiss);
/** Undo a removal. */
router.post('/patients/:publicId/documents/:id/findings/:findingId/restore', scope.edit, review.restore);

/**
 * Run a change for this patient as this doctor in one transaction, with its audit
 * entry written in the same transaction (who changed what, and when).
 */
const asDoctor = (action, run) => async (req, res, next) => {
	const { patientId } = req.patientAccess;
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const result = await run(client, req);
		if (!result) {
			await client.query('ROLLBACK');
			return fail(res, 404, 'NOT_FOUND', 'Not found.');
		}
		await recordAudit(
			{
				actorType: 'doctor', actorId: req.doctor.id, patientId, action, resourceType: result.resourceType,
				resourceId: result.resourceId, outcome: 'allowed', details: result.audit ?? {}, ipAddress: requestIp(req),
			},
			client,
		);
		await client.query('COMMIT');
		if (result.reconcile) await enqueueReconcile(patientId, action);
		return res.status(result.status ?? 200).json({ data: result.data });
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		if (error instanceof ClinicalRecordError) return fail(res, 400, 'INVALID_INPUT', error.message);
		return next(error);
	} finally {
		client.release();
	}
};

/** Confirm a finding is correct as recorded: marked Doctor-verified, nothing else changes (6.2.7). */
router.post(
	'/patients/:publicId/findings/:findingId/verify',
	scope.edit,
	asDoctor('finding.verify', async (client, req) => {
		if (!isUuid(req.params.findingId)) return null;
		const finding = await verifyFinding(client, { patientId: req.patientAccess.patientId, findingId: req.params.findingId, actor: { type: 'doctor', id: req.doctor.id } });
		return finding && { resourceType: 'finding', resourceId: finding.id, data: { finding } };
	}),
);

/** Mark a review flag resolved with a note (8.6: never resolved automatically). */
router.post(
	'/patients/:publicId/flags/:flagId/resolve',
	scope.edit,
	asDoctor('flag.resolve', async (client, req) => {
		if (!isUuid(req.params.flagId)) return null;
		const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
		if (!note || note.length > 1000) throw new ClinicalRecordError('Add a short note (up to 1000 characters) saying how this was reviewed.');
		const { rows } = await client.query(
			`UPDATE record_flags SET status = 'resolved', resolution_note = $3, resolved_by_doctor_id = $4, resolved_at = now()
			 WHERE id = $1 AND patient_id = $2 AND status = 'open'
			 RETURNING id, type`,
			[req.params.flagId, req.patientAccess.patientId, note, req.doctor.id],
		);
		return rows.length && { resourceType: 'flag', resourceId: rows[0].id, audit: { type: rows[0].type, note }, data: { flag: { id: rows[0].id, status: 'resolved' } } };
	}),
);

/** Add a clinical record: diagnoses, prescriptions, investigations, observations (6.2.8). */
router.post(
	'/patients/:publicId/clinical-records',
	scope.edit,
	asDoctor('clinical_record.create', async (client, req) => {
		const record = await createClinicalRecord(client, { patientId: req.patientAccess.patientId, doctorId: req.doctor.id, body: req.body });
		return {
			status: 201,
			resourceType: 'clinical_record',
			resourceId: record.id,
			audit: { items: record.findings.length, consultationDate: record.consultationDate },
			reconcile: record.findings.length > 0,
			data: { record },
		};
	}),
);

export default router;
