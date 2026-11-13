import { pool } from '../config/db.js';

/**
 * Append one entry to the audit log (section 7.1). The table is append-only.
 * Stores the action and the resource touched, never copies of medical content.
 *
 * @param {{ actorType: 'patient' | 'doctor' | 'system', actorId?: string | null,
 *           patientId?: string | null, action: string, resourceType: string,
 *           resourceId?: string | null, outcome: 'allowed' | 'denied',
 *           details?: object, ipAddress?: string | null }} entry
 * @param {import('pg').Pool | import('pg').PoolClient} [db]  pass a client to write inside a transaction
 */
export const recordAudit = async (entry, db = pool) => {
	await db.query(
		`INSERT INTO audit_logs (actor_type, actor_id, patient_id, action, resource_type, resource_id, details, ip_address)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		[
			entry.actorType,
			entry.actorId ?? null,
			entry.patientId ?? null,
			entry.action,
			entry.resourceType,
			entry.resourceId ?? null,
			JSON.stringify({ outcome: entry.outcome, ...(entry.details ?? {}) }),
			entry.ipAddress ?? null,
		],
	);
};

/** Like recordAudit, but never throws: for logging denials where the response must still go out. */
export const recordAuditSafely = async (entry) => {
	try {
		await recordAudit(entry);
	} catch (error) {
		console.error('Audit log write failed:', error.message);
	}
};

/** Client IP for the audit log; Express gives IPv4-mapped IPv6 addresses, which inet accepts. */
export const requestIp = (req) => req.ip || null;
