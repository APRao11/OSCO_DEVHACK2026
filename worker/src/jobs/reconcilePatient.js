/**
 * Step 8 - Reconcile: rebuild one patient's medication histories, condition
 * status, duplicates, contradictions and gaps (section 8.6).
 *
 * Runs as its own job, under a per-patient transaction-scoped advisory lock, so
 * two documents finishing at once cannot corrupt the same patient's timeline.
 * Reconciliation is deterministic: same accepted findings in, same output out.
 *
 * Each rule module in ../reconcile/ plugs in by exporting
 *   run({ client, patientId, claims }) -> Promise<void>
 * Modules that do not export run() yet are skipped and reported in the job result.
 */
import { UnrecoverableError } from 'bullmq';
import { withTransaction } from '../db.js';
import * as medicationEpisodes from '../reconcile/medicationEpisodes.js';
import * as conditionStatus from '../reconcile/conditionStatus.js';
import * as duplicates from '../reconcile/duplicates.js';
import * as contradictions from '../reconcile/contradictions.js';
import * as gaps from '../reconcile/gaps.js';

const RULES = [
	['medicationEpisodes', medicationEpisodes],
	['conditionStatus', conditionStatus],
	['duplicates', duplicates],
	['contradictions', contradictions],
	['gaps', gaps],
];

// Namespace for pg_advisory_xact_lock(int, int); the second key is derived from the patient id.
const RECONCILE_LOCK_NAMESPACE = 5508;

export const reconcilePatient = async (job) => {
	const { patientId } = job.data ?? {};
	if (!patientId) throw new UnrecoverableError('Job data must include patientId.');

	return withTransaction(async (client) => {
		await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [RECONCILE_LOCK_NAMESPACE, patientId]);

		const { rows: claims } = await client.query(
			`SELECT c.*, d.created_at AS document_created_at, d.document_date
			 FROM claims c
			 LEFT JOIN documents d ON d.id = c.document_id
			 WHERE c.patient_id = $1 AND c.retired_at IS NULL AND c.verification_status <> 'rejected'
			   -- Only what the patient confirmed, in its current (possibly patient-edited) version.
			   AND c.review_status = 'confirmed'
			   AND NOT EXISTS (SELECT 1 FROM claims newer WHERE newer.supersedes_id = c.id AND newer.retired_at IS NULL)
			 ORDER BY c.event_date NULLS LAST, d.created_at, c.created_at, c.id`,
			[patientId],
		);

		const ran = [];
		const pending = [];
		for (const [name, rule] of RULES) {
			if (typeof rule.run === 'function') {
				await rule.run({ client, patientId, claims });
				ran.push(name);
			} else {
				pending.push(name);
			}
		}

		return { patientId, claims: claims.length, rulesRun: ran, rulesNotImplemented: pending };
	});
};
