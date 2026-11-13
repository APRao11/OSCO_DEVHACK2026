/**
 * One BullMQ job per uploaded document (section 5.5, Flow C).
 *
 *   1 Ingest -> 2 OCR -> 3 Classify -> 4 Extract -> 5 Verify -> 6 Normalise -> 7 Save
 *   then step 8 (Reconcile) is queued as its own per-patient job.
 *
 * Job data: { documentId, patientId, fileHash }
 * A finding rejected in step 5 is not a failure. If the document fails, the
 * original stays stored and only this document is marked failed.
 */
import { resolve, sep } from 'node:path';
import { UnrecoverableError } from 'bullmq';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { enqueueReconcile } from '../queues.js';
import { ingest } from '../pipeline/1-ingest.js';
import { ocr } from '../pipeline/2-ocr.js';
import { classify } from '../pipeline/3-classify.js';
import { extract } from '../pipeline/4-extract.js';
import { verifyFindings } from '../pipeline/5-verify.js';
import { normalise } from '../pipeline/6-normalise.js';
import { save } from '../pipeline/7-save.js';

const resolveStoragePath = (storageKey) => {
	const root = config.documentStorageDir;
	const path = resolve(root, storageKey);
	if (path !== root && !path.startsWith(root + sep)) {
		throw new UnrecoverableError('Document storage key points outside the storage directory.');
	}
	return path;
};

const loadDocument = async (documentId, patientId) => {
	const { rows } = await pool.query(
		`SELECT id, patient_id, storage_key, mime_type, original_sha256
		 FROM documents WHERE id = $1`,
		[documentId],
	);
	const document = rows[0];
	if (!document) throw new UnrecoverableError(`Document ${documentId} does not exist.`);
	if (document.patient_id !== patientId) throw new UnrecoverableError('Job patientId does not match the document owner.');
	return document;
};

const isFinalAttempt = (job, error) =>
	error instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

export const processDocument = async (job) => {
	const { documentId, patientId, fileHash } = job.data ?? {};
	if (!documentId || !patientId) throw new UnrecoverableError('Job data must include documentId and patientId.');

	const log = (message) => job.log(`[${new Date().toISOString()}] ${message}`).catch(() => {});

	try {
		const document = await loadDocument(documentId, patientId);
		if (fileHash && fileHash !== document.original_sha256) {
			throw new UnrecoverableError('Job fileHash does not match the stored document hash.');
		}

		await pool.query(
			`UPDATE documents SET status = 'processing', processing_started_at = now(), processing_error = NULL WHERE id = $1`,
			[documentId],
		);

		// 1. Ingest
		const ingested = await ingest({
			filePath: resolveStoragePath(document.storage_key),
			mimeType: document.mime_type,
			expectedSha256: document.original_sha256,
			minTextLayerChars: config.ocr.minTextLayerChars,
		});
		await log(`ingest: ${ingested.pages.length} page(s), ${ingested.pages.filter((p) => p.needsOcr).length} need OCR`);
		await job.updateProgress(15);

		// 2. OCR (only pages without a usable text layer)
		const pages = await ocr(ingested, config.ocr);
		if (!pages.some((page) => page.text.trim())) {
			throw new UnrecoverableError('No text could be read from the document.');
		}
		await job.updateProgress(30);

		// 3. Classify
		const { documentType } = classify(pages);
		await log(`classify: ${documentType}`);

		// 4. Extract
		const extraction = await extract(
			{ fileHash: ingested.fileHash, extractorVersion: config.extractorVersion, documentType, pages },
			{ llm: config.llm, cacheDir: config.cacheDir },
		);
		await log(`extract: ${extraction.findings.length} finding(s) from ${extraction.model}${extraction.fromCache ? ' (cache)' : ''}`);
		await job.updateProgress(70);

		// 5. Verify
		const { accepted, rejected, stats } = verifyFindings(extraction.findings, pages, config.verifier);
		await log(`verify: ${stats.accepted} accepted, ${stats.rejected} rejected ${JSON.stringify(stats.rejectedByReason)}, ${stats.pageCorrections} page correction(s)`);

		// 6. Normalise
		const normalised = normalise(accepted, { localeHint: config.dateLocaleHint });

		// 7. Save
		const { claimsInserted } = await withTransaction(async (client) => {
			// Serialise saves of the same document (a retry racing a duplicate job).
			await client.query('SELECT id FROM documents WHERE id = $1 FOR UPDATE', [documentId]);
			return save(client, {
				documentId,
				patientId,
				extractorVersion: config.extractorVersion,
				documentType,
				pages,
				accepted: normalised,
				rejected,
				stats: { ...stats, model: extraction.model, fromCache: extraction.fromCache },
			});
		});
		await job.updateProgress(90);

		// 8. Reconcile (separate per-patient job)
		await enqueueReconcile(patientId, documentId);
		await job.updateProgress(100);

		return { documentId, documentType, pages: pages.length, claimsInserted, ...stats };
	} catch (error) {
		if (isFinalAttempt(job, error)) {
			await pool
				.query(`UPDATE documents SET status = 'failed', processing_error = $2 WHERE id = $1`, [documentId, String(error.message).slice(0, 1000)])
				.catch(() => {});
		}
		throw error;
	}
};
