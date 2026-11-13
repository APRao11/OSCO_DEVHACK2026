import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { isUuid, requirePatientAuth } from '../middleware/auth.js';
import { recordAuditSafely, requestIp } from '../services/audit.service.js';
import { enqueueDocument } from '../services/queue.service.js';

/**
 * Patient documents (MVP document sections 6.1.4, 5.5 and 8.9).
 *
 *   POST /api/documents            upload PDFs or images (multipart field "files")
 *   GET  /api/documents            the patient's documents with processing status
 *   GET  /api/documents/:id        one document with its verified findings
 *   POST /api/documents/:id/retry  queue a document that failed or was never queued
 *
 * The patient always comes from the login token. The original file is stored
 * first; if the queue is unavailable the document stays "uploaded" and can be
 * retried, so nothing is lost.
 */
const router = Router();

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

/** Detect the type from the file's bytes, never from the browser's claim. */
const sniffType = (buffer) => {
	const head = buffer.subarray(0, 12);
	if (head.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
	if (head[0] === 0x89 && head.subarray(1, 4).toString('latin1') === 'PNG') return { mime: 'image/png', ext: '.png' };
	if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mime: 'image/jpeg', ext: '.jpg' };
	const ascii = head.toString('latin1');
	if (ascii.startsWith('II*\0') || ascii.startsWith('MM\0*')) return { mime: 'image/tiff', ext: '.tif' };
	if (ascii.startsWith('BM')) return { mime: 'image/bmp', ext: '.bmp' };
	if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { mime: 'image/webp', ext: '.webp' };
	return null;
};

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

const DOCUMENT_COLUMNS = `
	d.id, d.original_filename, d.mime_type, d.byte_size, d.original_sha256, d.status, d.document_type,
	d.page_count, d.extraction_stats, d.processing_error, d.created_at, d.processed_at,
	to_char(d.document_date, 'YYYY-MM-DD') AS document_date, d.document_date_text, d.document_date_precision, d.document_date_alternatives,
	(SELECT count(*)::int FROM claims c WHERE c.document_id = d.id AND c.retired_at IS NULL) AS findings_count`;

const publicDocument = (row) => ({
	id: row.id,
	name: row.original_filename,
	mimeType: row.mime_type,
	byteSize: Number(row.byte_size),
	status: row.status,
	documentType: row.document_type,
	pageCount: row.page_count,
	uploadedAt: row.created_at,
	processedAt: row.processed_at,
	error: row.processing_error,
	findingsCount: row.findings_count ?? 0,
	// The document's own date, verified against its text; null if absent or ambiguous.
	documentDate: row.document_date,
	documentDateText: row.document_date_text,
	documentDatePrecision: row.document_date_precision,
	documentDateAlternatives: row.document_date_alternatives,
	stats: row.extraction_stats
		? {
				returned: row.extraction_stats.returned ?? 0,
				accepted: row.extraction_stats.accepted ?? 0,
				rejected: row.extraction_stats.rejected ?? 0,
				rejectedByReason: row.extraction_stats.rejectedByReason ?? {},
				pageCorrections: row.extraction_stats.pageCorrections ?? 0,
			}
		: null,
});

const loadDocument = async (documentId, patientId) => {
	const { rows } = await pool.query(`SELECT ${DOCUMENT_COLUMNS} FROM documents d WHERE d.id = $1 AND d.patient_id = $2`, [documentId, patientId]);
	return rows[0] ?? null;
};

/** Store the original under storage/originals/<patient>/<sha256><ext>; the same file is written once. */
const storeOriginal = async (patientId, hash, ext, buffer) => {
	const root = env.documentStorageDir;
	const storageKey = `${patientId}/${hash}${ext}`;
	const path = resolve(root, storageKey);
	if (!path.startsWith(root + sep)) throw new Error('Invalid storage path.');
	await mkdir(dirname(path), { recursive: true });
	try {
		await writeFile(path, buffer, { flag: 'wx' });
	} catch (error) {
		if (error.code !== 'EEXIST') throw error; // same hash = same bytes, already stored
	}
	return storageKey;
};

/** Queue a document; returns null on success or the reason it could not be queued. */
const tryEnqueue = async (row, patientId) => {
	try {
		await enqueueDocument({ documentId: row.id, patientId, fileHash: row.original_sha256 });
		return null;
	} catch (error) {
		return error.message;
	}
};

const acceptFiles = (req, res, next) =>
	upload.array('files', MAX_FILES)(req, res, (error) => {
		if (!error) return next();
		if (error instanceof multer.MulterError) {
			if (error.code === 'LIMIT_FILE_SIZE') return fail(res, 413, 'FILE_TOO_LARGE', 'Each file must be 10 MB or smaller.');
			if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
				return fail(res, 400, 'TOO_MANY_FILES', `Upload at most ${MAX_FILES} files at a time, in the "files" field.`);
			}
			return fail(res, 400, 'UPLOAD_ERROR', error.message);
		}
		return next(error);
	});

router.post('/', requirePatientAuth, acceptFiles, async (req, res, next) => {
	const { patientId } = req.auth;
	const files = req.files ?? [];
	if (!files.length) return fail(res, 400, 'NO_FILES', 'Choose at least one PDF or image to upload.');

	try {
		const results = [];
		for (const file of files) {
			const type = sniffType(file.buffer);
			if (!type) {
				results.push({ fileName: file.originalname, error: 'Only PDF, PNG, JPEG, TIFF, BMP or WebP files can be processed.' });
				continue;
			}
			const hash = createHash('sha256').update(file.buffer).digest('hex');

			// A file with the same hash for the same patient is recognised as already uploaded (6.1.4).
			const existing = await pool.query('SELECT id FROM documents WHERE patient_id = $1 AND original_sha256 = $2', [patientId, hash]);
			let row;
			let duplicate = false;
			if (existing.rowCount) {
				duplicate = true;
				row = await loadDocument(existing.rows[0].id, patientId);
			} else {
				const storageKey = await storeOriginal(patientId, hash, type.ext, file.buffer);
				const inserted = await pool.query(
					`INSERT INTO documents (patient_id, original_filename, storage_key, mime_type, byte_size, original_sha256)
					 VALUES ($1, $2, $3, $4, $5, $6)
					 ON CONFLICT (patient_id, original_sha256) DO NOTHING
					 RETURNING id`,
					[patientId, file.originalname.slice(0, 255), storageKey, type.mime, file.size, hash],
				);
				const id = inserted.rows[0]?.id ?? (await pool.query('SELECT id FROM documents WHERE patient_id = $1 AND original_sha256 = $2', [patientId, hash])).rows[0].id;
				duplicate = !inserted.rowCount;
				row = await loadDocument(id, patientId);
			}

			// Queue new documents, and duplicates that never finished.
			let queueError = null;
			if (!duplicate || row.status === 'uploaded' || row.status === 'failed') queueError = await tryEnqueue(row, patientId);

			await recordAuditSafely({
				actorType: 'patient', actorId: patientId, patientId, action: 'document.upload',
				resourceType: 'document', resourceId: row.id, outcome: 'allowed', details: { duplicate, queued: !queueError },
				ipAddress: requestIp(req),
			});
			results.push({ fileName: file.originalname, duplicate, queued: !queueError, queueError, document: publicDocument(row) });
		}
		return res.status(201).json({ data: { results } });
	} catch (error) {
		return next(error);
	}
});

router.get('/', requirePatientAuth, async (req, res, next) => {
	try {
		const { rows } = await pool.query(
			`SELECT ${DOCUMENT_COLUMNS} FROM documents d WHERE d.patient_id = $1 ORDER BY d.created_at DESC LIMIT 200`,
			[req.auth.patientId],
		);
		return res.status(200).json({ data: { documents: rows.map(publicDocument) } });
	} catch (error) {
		return next(error);
	}
});

router.get('/:id', requirePatientAuth, async (req, res, next) => {
	const { patientId } = req.auth;
	if (!isUuid(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
	try {
		const row = await loadDocument(req.params.id, patientId);
		if (!row) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
		// Only accepted findings; rejected ones stay hidden (section 7.2.7).
		const { rows: findings } = await pool.query(
			`SELECT id, category, name, name_normalised, subject, subject_relation, assertion, action, dose, frequency,
			        value, unit, ref_range, date_text, to_char(event_date, 'YYYY-MM-DD') AS event_date, date_precision,
			        quote, page, quote_start, quote_end, source_type, verification_status
			 FROM claims
			 WHERE document_id = $1 AND patient_id = $2 AND retired_at IS NULL AND verification_status <> 'rejected'
			 ORDER BY page, quote_start`,
			[row.id, patientId],
		);
		return res.status(200).json({
			data: {
				document: publicDocument(row),
				findings: findings.map((f) => ({
					id: f.id, category: f.category, name: f.name, nameNormalised: f.name_normalised, subject: f.subject,
					subjectRelation: f.subject_relation, assertion: f.assertion, action: f.action, dose: f.dose,
					frequency: f.frequency, value: f.value, unit: f.unit, refRange: f.ref_range, dateText: f.date_text,
					eventDate: f.event_date, datePrecision: f.date_precision, quote: f.quote, page: f.page,
					quoteStart: f.quote_start, quoteEnd: f.quote_end, sourceType: f.source_type, verificationStatus: f.verification_status,
				})),
			},
		});
	} catch (error) {
		return next(error);
	}
});

router.post('/:id/retry', requirePatientAuth, async (req, res, next) => {
	const { patientId } = req.auth;
	if (!isUuid(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
	try {
		const row = await loadDocument(req.params.id, patientId);
		if (!row) return fail(res, 404, 'NOT_FOUND', 'Document not found.');
		if (row.status === 'processing' || row.status === 'ready') {
			return fail(res, 409, 'NOT_RETRYABLE', `This document is already ${row.status}.`);
		}
		await pool.query(`UPDATE documents SET status = 'uploaded', processing_error = NULL WHERE id = $1`, [row.id]);
		const queueError = await tryEnqueue(row, patientId);
		if (queueError) return fail(res, 503, 'QUEUE_UNAVAILABLE', `${queueError} The document is stored and can be retried later.`);
		return res.status(202).json({ data: { document: publicDocument(await loadDocument(row.id, patientId)) } });
	} catch (error) {
		return next(error);
	}
});

export default router;
