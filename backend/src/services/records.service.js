import { pool } from '../config/db.js';
import { CURRENT_VERSION, FINDING_COLUMNS, toFinding } from './findings.service.js';

/**
 * A patient's medical history in the frontend's PatientRecords shape
 * (MVP document 6.1.5), shared by the patient and doctor dashboards.
 *
 * Only findings the patient has CONFIRMED appear, in their current version (a
 * correction replaces what it corrects; the original stays in the database as
 * evidence). Findings still waiting for the patient's review are counted, not shown.
 *
 * @param {string} patientId  internal patient UUID
 * @param {{ fileUrl: (documentId: string) => string }} options  where the original file is served for this viewer
 */
export const buildPatientRecords = async (patientId, { fileUrl }) => {
	const [patient, documents, findings, pages, histories, review] = await Promise.all([
		pool.query('SELECT full_name, public_id FROM patients WHERE id = $1', [patientId]),
		pool.query(
			`SELECT d.id, d.original_filename, d.mime_type, d.status, d.document_type, d.page_count, d.extraction_stats,
			        to_char(d.document_date, 'YYYY-MM-DD') AS document_date, d.document_date_text, d.document_date_alternatives
			 FROM documents d WHERE d.patient_id = $1 ORDER BY d.created_at`,
			[patientId],
		),
		pool.query(
			`SELECT ${FINDING_COLUMNS} FROM claims c
			 WHERE c.patient_id = $1 AND c.review_status = 'confirmed' AND ${CURRENT_VERSION}
			 ORDER BY c.document_id, c.page, c.quote_start`,
			[patientId],
		),
		pool.query(
			`SELECT p.document_id, p.page_number, p.page_text
			 FROM document_pages p JOIN documents d ON d.id = p.document_id
			 WHERE d.patient_id = $1 ORDER BY p.document_id, p.page_number`,
			[patientId],
		),
		pool.query('SELECT history FROM medication_histories WHERE patient_id = $1 ORDER BY drug', [patientId]),
		pool.query(
			`SELECT count(DISTINCT c.document_id)::int AS documents, count(*)::int AS findings
			 FROM claims c WHERE c.patient_id = $1 AND c.review_status = 'pending' AND ${CURRENT_VERSION}`,
			[patientId],
		),
	]);

	const pagesByDocument = new Map();
	for (const page of pages.rows) {
		if (!pagesByDocument.has(page.document_id)) pagesByDocument.set(page.document_id, []);
		pagesByDocument.get(page.document_id).push({ pageNumber: page.page_number, text: page.page_text });
	}

	const totals = { returned: 0, accepted: 0, rejected: 0, rejectedByReason: {}, pageCorrections: 0 };
	for (const doc of documents.rows) {
		const stats = doc.extraction_stats;
		if (!stats) continue;
		totals.returned += stats.returned ?? 0;
		totals.accepted += stats.accepted ?? 0;
		totals.rejected += stats.rejected ?? 0;
		totals.pageCorrections += stats.pageCorrections ?? 0;
		for (const [reason, n] of Object.entries(stats.rejectedByReason ?? {})) totals.rejectedByReason[reason] = (totals.rejectedByReason[reason] ?? 0) + n;
	}

	return {
		patientId: patient.rows[0]?.public_id ?? '',
		patientName: patient.rows[0]?.full_name ?? '',
		builtAt: new Date().toISOString().slice(0, 10),
		extractionStats: totals,
		pendingReview: review.rows[0],
		documents: documents.rows.map((doc) => ({
			id: doc.id,
			name: doc.original_filename,
			// PDFs open in the Source Viewer; images fall back to their OCR text with the quote marked.
			fileUrl: doc.mime_type === 'application/pdf' ? fileUrl(doc.id) : null,
			documentType: doc.document_type ?? 'other',
			documentDate: doc.document_date,
			documentDateText: doc.document_date_text,
			dateAlternatives: doc.document_date_alternatives,
			status: doc.status,
			pageCount: doc.page_count ?? 0,
			pages: pagesByDocument.get(doc.id) ?? [],
		})),
		findings: findings.rows.map(toFinding),
		medicationHistories: histories.rows.map((row) => row.history),
		// Contradiction and gap rules (8.6) are not implemented yet; medication flags live in each history.
		flags: [],
	};
};
