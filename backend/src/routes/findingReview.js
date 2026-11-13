import { resolve, sep } from 'node:path';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { isUuid } from '../middleware/auth.js';
import { recordAudit, requestIp } from '../services/audit.service.js';
import { loadDocument, publicDocument } from '../services/documents.service.js';
import {
	confirmDocument,
	editFinding,
	FindingInputError,
	listDocumentFindings,
	setDismissed,
} from '../services/findings.service.js';
import { enqueueReconcile } from '../services/queue.service.js';

/**
 * Review handlers shared by the patient and doctor dashboards, so both apply
 * exactly the same rules (MVP document 6.1.5, 6.2.7, 7.3 rule 8):
 * edits are new versions, removals are kept, and every action is audited with
 * who did it. Each router supplies:
 *
 *   context(req) -> { patientId, actor: { type: 'patient' | 'doctor', id }, auditPatientId }
 *   scope        -> 'patient' (sees everything incl. pending) | 'doctor' (sees the confirmed history)
 *
 * Authorisation (login, consent) is enforced by the router's middleware before
 * these run; everything here is additionally limited to that patient's rows.
 */

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

/** A filename safe to put inside a quoted Content-Disposition header. */
const safeFilename = (name) => name.replace(/[^\w .()-]/g, '_');

export const findingReviewHandlers = ({ context, scope }) => {
	/** Run one review action in a transaction, audit it, and answer with the updated document. */
	const action = (name, run) => async (req, res, next) => {
		const { patientId, actor } = context(req);
		const { id: documentId, findingId } = req.params;
		if (!isUuid(documentId) || (findingId !== undefined && !isUuid(findingId))) return fail(res, 404, 'NOT_FOUND', 'Not found.');

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const doc = await client.query('SELECT id, status FROM documents WHERE id = $1 AND patient_id = $2 FOR UPDATE', [documentId, patientId]);
			if (!doc.rowCount) {
				await client.query('ROLLBACK');
				return fail(res, 404, 'NOT_FOUND', 'Document not found.');
			}
			if (doc.rows[0].status !== 'ready') {
				await client.query('ROLLBACK');
				return fail(res, 409, 'NOT_READY', 'Findings can be reviewed once the document is Ready.');
			}
			const result = await run(client, { patientId, documentId, findingId, body: req.body, actor });
			if (!result) {
				await client.query('ROLLBACK');
				return fail(res, 404, 'NOT_FOUND', 'Finding not found.');
			}
			// The audit entry is part of the change: if it cannot be written, nothing changes.
			await recordAudit(
				{
					actorType: actor.type, actorId: actor.id, patientId, action: name,
					resourceType: findingId ? 'finding' : 'document', resourceId: findingId ?? documentId,
					outcome: 'allowed', details: { documentId, ...(result.audit ?? {}) }, ipAddress: requestIp(req),
				},
				client,
			);
			await client.query('COMMIT');

			// The medication history only changes when confirmed findings change.
			if (result.affectsHistory) await enqueueReconcile(patientId, name);

			return res.status(200).json({
				data: {
					document: publicDocument(await loadDocument(documentId, patientId)),
					findings: await listDocumentFindings(patientId, documentId, pool, { scope }),
					...(result.finding ? { finding: result.finding } : {}),
				},
			});
		} catch (error) {
			await client.query('ROLLBACK').catch(() => {});
			if (error instanceof FindingInputError) return fail(res, 400, 'INVALID_INPUT', error.message);
			return next(error);
		} finally {
			client.release();
		}
	};

	return {
		/** GET a document with the findings this viewer may see. */
		get: async (req, res, next) => {
			const { patientId } = context(req);
			if (!isUuid(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
			try {
				const row = await loadDocument(req.params.id, patientId);
				if (!row) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
				const findings = await listDocumentFindings(patientId, row.id, pool, { scope });
				return res.status(200).json({ data: { document: publicDocument(row), findings } });
			} catch (error) {
				return next(error);
			}
		},

		/** Edit: saved as a new version by this actor; the original stays as evidence. */
		edit: action('finding.edit', async (client, ctx) => {
			const result = await editFinding(client, ctx);
			if (!result) return null;
			return {
				finding: result.finding,
				affectsHistory: result.finding.reviewStatus === 'confirmed',
				audit: { changedFields: result.changedFields, previousId: result.previousId, newId: result.finding.id },
			};
		}),

		/** Remove a wrong finding. It is kept, never shown, and can be restored. */
		dismiss: action('finding.dismiss', async (client, ctx) => {
			const result = await setDismissed(client, { ...ctx, dismissed: true });
			return result && { finding: result.finding, affectsHistory: result.wasConfirmed };
		}),

		/** Undo a removal: the finding returns to the review state it had. */
		restore: action('finding.restore', async (client, ctx) => {
			const result = await setDismissed(client, { ...ctx, dismissed: false });
			return result && { finding: result.finding, affectsHistory: result.wasConfirmed };
		}),

		/** Add the document's reviewed findings to the medical history (patients only). */
		confirm: action('document.confirm_findings', async (client, ctx) => {
			const confirmed = await confirmDocument(client, ctx);
			return { affectsHistory: confirmed > 0, audit: { confirmed } };
		}),

		/** The original file, for the Source Viewer; never served from a public folder (6.1.6). */
		file: async (req, res, next) => {
			const { patientId } = context(req);
			if (!isUuid(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
			try {
				const row = await loadDocument(req.params.id, patientId);
				if (!row) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
				const root = env.documentStorageDir;
				const path = resolve(root, row.storage_key);
				if (!path.startsWith(root + sep)) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
				res.set({
					'Content-Type': row.mime_type,
					'Content-Disposition': `inline; filename="${safeFilename(row.original_filename)}"`,
					'Cache-Control': 'private, no-store',
					// The frontend runs on another origin during development.
					'Cross-Origin-Resource-Policy': 'cross-origin',
				});
				return res.sendFile(path, (error) => {
					if (error && !res.headersSent) fail(res, 404, 'NOT_FOUND', 'The original file is missing.');
				});
			} catch (error) {
				return next(error);
			}
		},
	};
};
