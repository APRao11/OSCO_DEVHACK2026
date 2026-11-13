import { pool } from '../config/db.js';
import { recordAuditSafely, requestIp } from '../services/audit.service.js';

const PUBLIC_ID = /^OSCO-[2-9A-HJ-NP-Z]{8}$/;

/**
 * Patient scope for doctors (MVP document 7.1, step 4).
 *
 * A doctor reaches a patient only through an access session that the patient
 * approved, that has not expired and that was not ended (by the patient, or by
 * the doctor's revocation). Checked in the database on every request, so ending
 * access takes effect on the very next request. Edits additionally need the
 * patient to have granted 'edit' ("view and correct") access.
 *
 * Must run after requireDoctorAuth + requireVerifiedDoctor. Route param: :publicId.
 * Sets req.patientAccess = { patientId, publicId, sessionId, accessLevel, expiresAt }.
 *
 * @param {'read' | 'edit'} level
 */
export const requirePatientAccess = (level) => async (req, res, next) => {
	const doctorId = req.doctor?.id;
	const publicId = String(req.params.publicId ?? '').toUpperCase();
	const deny = async (status, code, message, reason, patientId = null) => {
		await recordAuditSafely({
			actorType: 'doctor', actorId: doctorId, patientId, action: 'patient_record.access',
			resourceType: 'patient', resourceId: patientId, outcome: 'denied',
			details: { reason, requiredLevel: level, method: req.method, path: req.originalUrl }, ipAddress: requestIp(req),
		});
		return res.status(status).json({ error: { code, message } });
	};

	if (!doctorId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A valid doctor access token is required.' } });
	if (!PUBLIC_ID.test(publicId)) return deny(404, 'NOT_FOUND', 'Patient not found.', 'bad_patient_id');

	try {
		const { rows } = await pool.query(
			`SELECT p.id AS patient_id, s.id AS session_id, s.access_level, s.expires_at
			 FROM patients p
			 LEFT JOIN doctor_access_sessions s
			   ON s.patient_id = p.id AND s.doctor_id = $2 AND s.revoked_at IS NULL AND s.expires_at > statement_timestamp()
			 WHERE p.public_id = $1
			 ORDER BY (s.access_level = 'edit') DESC NULLS LAST, s.expires_at DESC NULLS LAST
			 LIMIT 1`,
			[publicId, doctorId],
		);
		const row = rows[0];
		// Same answer for "no such patient" and "no access", so IDs cannot be probed.
		if (!row || !row.session_id) {
			return deny(403, 'NO_ACCESS', 'You do not have active access to this patient. Ask the patient to approve a request.', 'no_active_session', row?.patient_id ?? null);
		}
		if (level === 'edit' && row.access_level !== 'edit') {
			return deny(403, 'EDIT_NOT_PERMITTED', 'The patient approved view-only access. Ask for "view and correct" access to make changes.', 'read_only_session', row.patient_id);
		}
		req.patientAccess = { patientId: row.patient_id, publicId, sessionId: row.session_id, accessLevel: row.access_level, expiresAt: row.expires_at };
		return next();
	} catch (error) {
		return next(error); // fail closed
	}
};
