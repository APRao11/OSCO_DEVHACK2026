/**
 * Step 7 - Save: store page text, accepted findings (with assertion and subject)
 * and rejected findings in one transaction. Safe to run twice: every row has a
 * deterministic fingerprint and is inserted with ON CONFLICT DO NOTHING.
 */
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const FINGERPRINT_FIELDS = [
	'category', 'name', 'subject', 'subject_relation', 'assertion', 'action', 'dose', 'frequency',
	'value', 'unit', 'ref_range', 'date_text', 'page', 'quote_start', 'quote_end',
];

export const claimFingerprint = (finding) => hash(FINGERPRINT_FIELDS.map((field) => finding[field] ?? null));
export const rejectionFingerprint = (rejection) => hash([rejection.reason, rejection.raw]);

/** event_date column is a DATE; month/year precision is kept in date_precision. */
const toSqlDate = (eventDate) => {
	if (!eventDate) return null;
	if (/^\d{4}$/.test(eventDate)) return `${eventDate}-01-01`;
	if (/^\d{4}-\d{2}$/.test(eventDate)) return `${eventDate}-01`;
	return eventDate;
};

/**
 * @param {import('pg').PoolClient} client  inside a transaction
 */
export const save = async (client, { documentId, patientId, extractorVersion, documentType, pages, accepted, rejected, stats, documentDate = null }) => {
	// The stored page text must be the text this run's quote offsets point into. A re-run
	// can read a page differently (for example after an OCR improvement), so it replaces
	// the derived text; the original file itself is never changed.
	for (const page of pages) {
		await client.query(
			`INSERT INTO document_pages (document_id, page_number, text_source, page_text, ocr_words)
			 VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (document_id, page_number)
			 DO UPDATE SET text_source = EXCLUDED.text_source, page_text = EXCLUDED.page_text, ocr_words = EXCLUDED.ocr_words`,
			[documentId, page.pageNumber, page.source, page.text, page.ocrWords ? JSON.stringify(page.ocrWords) : null],
		);
	}

	// A re-run replaces only this document's earlier, unreviewed AI results that this run did
	// not produce again (identical findings keep their rows, so re-running is a no-op).
	// Rows are retired, not deleted; doctor-reviewed findings are left alone.
	const keep = accepted.map(claimFingerprint);
	await client.query(
		`UPDATE claims SET retired_at = now()
		 WHERE document_id = $1 AND source_type = 'ai_extracted' AND verification_status = 'unverified'
		   AND review_status = 'pending' -- the patient's confirmations and removals survive a re-run
		   AND retired_at IS NULL
		   AND NOT (extractor_version = $2 AND fingerprint = ANY($3::char(64)[]))`,
		[documentId, extractorVersion, keep],
	);

	let inserted = 0;
	for (const finding of accepted) {
		const result = await client.query(
			`INSERT INTO claims (
				patient_id, document_id, category, name, name_normalised, subject, subject_relation,
				assertion, action, dose, frequency, value, unit, ref_range,
				date_text, event_date, date_precision, normalised,
				quote, page, quote_start, quote_end, match_type, ocr_word_boxes,
				source_type, verification_status, extractor_version, fingerprint
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
				$15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
				'ai_extracted', 'unverified', $25, $26
			) ON CONFLICT DO NOTHING`,
			[
				patientId, documentId, finding.category, finding.name, finding.name_normalised,
				finding.subject, finding.subject_relation, finding.assertion, finding.action,
				finding.dose, finding.frequency, finding.value, finding.unit, finding.ref_range,
				finding.date_text, toSqlDate(finding.event_date), finding.date_precision,
				JSON.stringify({ ...finding.normalised, page_corrected: finding.page_corrected, stated_page: finding.stated_page }),
				finding.quote, finding.page, finding.quote_start, finding.quote_end, finding.match_type,
				finding.ocr_word_boxes ? JSON.stringify(finding.ocr_word_boxes) : null,
				extractorVersion, claimFingerprint(finding),
			],
		);
		inserted += result.rowCount;
	}

	for (const rejection of rejected) {
		await client.query(
			`INSERT INTO rejected_claims (patient_id, document_id, extractor_version, reason, detail, raw_output, fingerprint)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT DO NOTHING`,
			[
				patientId, documentId, extractorVersion, rejection.reason, rejection.detail,
				JSON.stringify(rejection.raw ?? null), rejectionFingerprint(rejection),
			],
		);
	}

	await client.query(
		`UPDATE documents
		 SET status = 'ready', document_type = $2, page_count = $3, extractor_version = $4,
		     extraction_stats = $5, processing_error = NULL, processed_at = now(),
		     document_date = $6, document_date_text = $7, document_date_precision = $8, document_date_alternatives = $9
		 WHERE id = $1`,
		[
			documentId, documentType, pages.length, extractorVersion, JSON.stringify(stats),
			toSqlDate(documentDate?.event_date ?? null),
			documentDate?.date_text ?? null,
			documentDate?.date_precision ?? null,
			documentDate?.date_alternatives ? JSON.stringify(documentDate.date_alternatives) : null,
		],
	);

	return { claimsInserted: inserted };
};
