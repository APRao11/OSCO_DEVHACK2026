import { pool } from '../config/db.js';
import { CURRENT_VERSION } from './findings.service.js';

/** Document columns with live review counts (current versions of findings only). */
export const DOCUMENT_COLUMNS = `
	d.id, d.original_filename, d.mime_type, d.byte_size, d.original_sha256, d.status, d.document_type,
	d.page_count, d.extraction_stats, d.processing_error, d.created_at, d.processed_at, d.storage_key,
	to_char(d.document_date, 'YYYY-MM-DD') AS document_date, d.document_date_text, d.document_date_precision, d.document_date_alternatives,
	(SELECT count(*)::int FROM claims c WHERE c.document_id = d.id AND c.review_status <> 'dismissed' AND ${CURRENT_VERSION}) AS findings_count,
	(SELECT count(*)::int FROM claims c WHERE c.document_id = d.id AND c.review_status = 'pending' AND ${CURRENT_VERSION}) AS pending_count,
	(SELECT count(*)::int FROM claims c WHERE c.document_id = d.id AND c.review_status = 'confirmed' AND ${CURRENT_VERSION}) AS confirmed_count,
	(SELECT count(*)::int FROM claims c WHERE c.document_id = d.id AND c.review_status = 'dismissed' AND ${CURRENT_VERSION}) AS dismissed_count`;

/** A document as the API returns it (never the storage key or file hash). */
export const publicDocument = (row) => ({
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
	// Patient review: pending findings are not in the medical history until confirmed.
	review: {
		pending: row.pending_count ?? 0,
		confirmed: row.confirmed_count ?? 0,
		dismissed: row.dismissed_count ?? 0,
	},
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

/** One document, only if it belongs to this patient. */
export const loadDocument = async (documentId, patientId, db = pool) => {
	const { rows } = await db.query(`SELECT ${DOCUMENT_COLUMNS} FROM documents d WHERE d.id = $1 AND d.patient_id = $2`, [documentId, patientId]);
	return rows[0] ?? null;
};
