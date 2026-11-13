import { pool } from '../config/db.js';

/**
 * Findings ("claims") as the patient sees them, plus the review actions.
 *
 * The CURRENT version of a finding is a row that is not retired, not rejected
 * and not superseded by a newer correction. Edits never overwrite a row: they
 * add a patient_corrected row that supersedes it (MVP document 7.3 rule 8).
 */

/** SQL condition selecting current versions; expects the claims table aliased as c. */
export const CURRENT_VERSION = `
	c.retired_at IS NULL
	AND c.verification_status <> 'rejected'
	AND NOT EXISTS (SELECT 1 FROM claims newer WHERE newer.supersedes_id = c.id AND newer.retired_at IS NULL)`;

export const FINDING_COLUMNS = `
	c.id, c.document_id, c.category, c.name, c.name_normalised, c.subject, c.subject_relation, c.assertion,
	c.action, c.dose, c.frequency, c.value, c.unit, c.ref_range, c.date_text,
	to_char(c.event_date, 'YYYY-MM-DD') AS event_date, c.date_precision, c.normalised,
	c.quote, c.page, c.quote_start, c.quote_end, c.match_type, c.source_type, c.verification_status,
	c.review_status, c.supersedes_id, c.created_at,
	(SELECT o.quote FROM claims o WHERE o.id = c.supersedes_id) AS supersedes_quote`;

export const toFinding = (row) => ({
	id: row.id,
	documentId: row.document_id,
	category: row.category,
	name: row.name,
	nameNormalised: row.name_normalised,
	subject: row.subject,
	subjectRelation: row.subject_relation,
	assertion: row.assertion,
	action: row.action,
	dose: row.dose,
	frequency: row.frequency,
	value: row.value,
	unit: row.unit,
	refRange: row.ref_range,
	dateText: row.date_text,
	eventDate: row.event_date,
	datePrecision: row.date_precision,
	dateAlternatives: row.normalised?.date_alternatives ?? null,
	quote: row.quote,
	page: row.page,
	quoteStart: row.quote_start,
	quoteEnd: row.quote_end,
	matchType: row.match_type,
	sourceType: row.source_type,
	verificationStatus: row.verification_status,
	reviewStatus: row.review_status,
	supersedesId: row.supersedes_id,
});

/** Current findings of one of the patient's documents, in reading order. */
export const listDocumentFindings = async (patientId, documentId, db = pool) => {
	const { rows } = await db.query(
		`SELECT ${FINDING_COLUMNS} FROM claims c
		 WHERE c.document_id = $1 AND c.patient_id = $2 AND ${CURRENT_VERSION}
		 ORDER BY c.page, c.quote_start, c.created_at`,
		[documentId, patientId],
	);
	return rows.map(toFinding);
};

// ------------------------------------------------------------------ editing

const ASSERTIONS = ['present', 'absent', 'possible', 'historical'];
const TEXT_FIELDS = { name: 'name', dose: 'dose', frequency: 'frequency', value: 'value', unit: 'unit', refRange: 'ref_range' };

export class FindingInputError extends Error {}

/**
 * Validate a patient's edit. Only fields that are present in the body change.
 * @returns {Record<string, string | null>} column -> new value
 */
export const parseFindingEdit = (body, current) => {
	if (!body || typeof body !== 'object') throw new FindingInputError('Send the fields to change.');
	const changes = {};

	for (const [key, column] of Object.entries(TEXT_FIELDS)) {
		if (!(key in body)) continue;
		const raw = body[key];
		if (raw !== null && typeof raw !== 'string') throw new FindingInputError(`${key} must be text.`);
		const value = raw?.trim() || null;
		if (value && value.length > 200) throw new FindingInputError(`${key} must be 200 characters or fewer.`);
		if (key === 'name' && !value) throw new FindingInputError('Name cannot be empty.');
		if ((key === 'dose' || key === 'frequency') && current.category !== 'medication' && value) {
			throw new FindingInputError('Dose and frequency only apply to medicines.');
		}
		if (value !== (current[column] ?? null)) changes[column] = value;
	}

	if ('assertion' in body) {
		if (!ASSERTIONS.includes(body.assertion)) throw new FindingInputError(`assertion must be one of ${ASSERTIONS.join(', ')}.`);
		if (body.assertion !== current.assertion) changes.assertion = body.assertion;
	}

	if ('date' in body) {
		const date = body.date === null || body.date === '' ? null : body.date;
		if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
			throw new FindingInputError('date must be YYYY-MM-DD.');
		}
		if (date !== (current.event_date ?? null)) {
			changes.event_date = date;
			changes.date_text = date;
			changes.date_precision = date ? 'day' : null;
		}
	}

	if (!Object.keys(changes).length) throw new FindingInputError('Nothing was changed.');
	return changes;
};

/** Load one current finding that belongs to this patient and document, locked for update. */
const loadCurrent = async (client, patientId, documentId, findingId) => {
	const { rows } = await client.query(
		`SELECT c.*, to_char(c.event_date, 'YYYY-MM-DD') AS event_date
		 FROM claims c
		 WHERE c.id = $1 AND c.document_id = $2 AND c.patient_id = $3 AND ${CURRENT_VERSION}
		 FOR UPDATE`,
		[findingId, documentId, patientId],
	);
	return rows[0] ?? null;
};

/**
 * Apply a patient edit as a new row that supersedes the current one.
 * The document quote stays attached, so the original evidence is always shown.
 * @returns {Promise<object | null>} the new finding, or null if not found
 */
export const editFinding = async (client, { patientId, documentId, findingId, body }) => {
	const current = await loadCurrent(client, patientId, documentId, findingId);
	if (!current) return null;
	const changes = parseFindingEdit(body, current);
	const next = { ...current, ...changes };
	if ('name' in changes) next.name_normalised = changes.name.toLowerCase().replace(/\s+/g, ' ');

	const { rows } = await client.query(
		`INSERT INTO claims (
			patient_id, document_id, category, name, name_normalised, subject, subject_relation, assertion, action,
			dose, frequency, value, unit, ref_range, date_text, event_date, date_precision, normalised,
			quote, page, quote_start, quote_end, match_type, ocr_word_boxes,
			source_type, verification_status, supersedes_id, extractor_version, review_status, reviewed_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23, $24, 'patient_corrected', 'unverified', $25, $26, $27, $28
		) RETURNING id`,
		[
			next.patient_id, next.document_id, next.category, next.name, next.name_normalised, next.subject, next.subject_relation,
			next.assertion, next.action, next.dose, next.frequency, next.value, next.unit, next.ref_range, next.date_text,
			next.event_date, next.date_precision, JSON.stringify({ ...(current.normalised ?? {}), edited_fields: Object.keys(changes) }),
			current.quote, current.page, current.quote_start, current.quote_end, current.match_type,
			current.ocr_word_boxes ? JSON.stringify(current.ocr_word_boxes) : null,
			current.id, current.extractor_version, current.review_status, current.reviewed_at,
		],
	);
	// The original stays as evidence; marking it corrected also keeps a re-run from retiring it.
	await client.query(`UPDATE claims SET verification_status = 'corrected' WHERE id = $1 AND verification_status = 'unverified'`, [current.id]);

	const { rows: created } = await client.query(`SELECT ${FINDING_COLUMNS} FROM claims c WHERE c.id = $1`, [rows[0].id]);
	return { finding: toFinding(created[0]), changedFields: Object.keys(changes), previousId: current.id };
};

/** Remove (dismissed) or bring back (pending) a finding. Nothing is deleted. */
export const setDismissed = async (client, { patientId, documentId, findingId, dismissed }) => {
	const current = await loadCurrent(client, patientId, documentId, findingId);
	if (!current) return null;
	const status = dismissed ? 'dismissed' : 'pending';
	const { rows } = await client.query(
		`UPDATE claims SET review_status = $2, reviewed_at = now() WHERE id = $1
		 RETURNING id`,
		[current.id, status],
	);
	const { rows: updated } = await client.query(`SELECT ${FINDING_COLUMNS} FROM claims c WHERE c.id = $1`, [rows[0].id]);
	return { finding: toFinding(updated[0]), wasConfirmed: current.review_status === 'confirmed' };
};

/** Add all pending findings of a document to the medical history. */
export const confirmDocument = async (client, { patientId, documentId }) => {
	const { rowCount } = await client.query(
		`UPDATE claims c SET review_status = 'confirmed', reviewed_at = now()
		 WHERE c.document_id = $1 AND c.patient_id = $2 AND c.review_status = 'pending' AND ${CURRENT_VERSION}`,
		[documentId, patientId],
	);
	return rowCount;
};
