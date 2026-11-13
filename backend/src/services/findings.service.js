import { pool } from '../config/db.js';

/**
 * Findings ("claims") as patients and doctors see them, plus the review actions.
 *
 * The CURRENT version of a finding is a row that is not retired, not rejected
 * and not superseded by a newer correction. Edits never overwrite a row: they
 * add a correction row that supersedes it (MVP document 7.3 rule 8). Every
 * action records who did it (actor: { type: 'patient' | 'doctor', id }).
 */

/** SQL condition selecting current versions; expects the claims table aliased as c. */
export const CURRENT_VERSION = `
	c.retired_at IS NULL
	AND c.verification_status <> 'rejected'
	AND NOT EXISTS (SELECT 1 FROM claims newer WHERE newer.supersedes_id = c.id AND newer.retired_at IS NULL)`;

/**
 * A doctor sees the medical history: what the patient confirmed, plus confirmed
 * findings that were later removed (so a removal can be seen and undone). Findings
 * the patient has not reviewed yet are the patient's to decide on, not the doctor's.
 */
export const DOCTOR_VISIBLE = `(c.review_status = 'confirmed' OR (c.review_status = 'dismissed' AND c.previous_review_status = 'confirmed'))`;

export const FINDING_COLUMNS = `
	c.id, c.document_id, c.category, c.name, c.name_normalised, c.subject, c.subject_relation, c.assertion,
	c.action, c.dose, c.frequency, c.value, c.unit, c.ref_range, c.date_text,
	to_char(c.event_date, 'YYYY-MM-DD') AS event_date, c.date_precision, c.normalised,
	c.quote, c.page, c.quote_start, c.quote_end, c.match_type, c.source_type, c.verification_status,
	c.review_status, c.supersedes_id, c.created_at, c.reviewed_at, c.previous_review_status,
	c.author_type, c.reviewed_by_type,
	(SELECT d.full_name FROM doctors d WHERE c.author_type = 'doctor' AND d.id = c.author_id) AS author_doctor_name,
	(SELECT d.full_name FROM doctors d WHERE c.reviewed_by_type = 'doctor' AND d.id = c.reviewed_by_id) AS reviewer_doctor_name`;

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
	previousReviewStatus: row.previous_review_status,
	// Who made this version (corrections), and who last removed, restored or confirmed it.
	editedBy: row.author_type ? { type: row.author_type, name: row.author_doctor_name ?? null, at: row.created_at } : null,
	reviewedBy: row.reviewed_by_type ? { type: row.reviewed_by_type, name: row.reviewer_doctor_name ?? null, at: row.reviewed_at } : null,
});

/**
 * Current findings of one of the patient's documents, in reading order.
 * scope 'doctor' limits them to what a doctor may see (DOCTOR_VISIBLE).
 */
export const listDocumentFindings = async (patientId, documentId, db = pool, { scope = 'patient' } = {}) => {
	const { rows } = await db.query(
		`SELECT ${FINDING_COLUMNS} FROM claims c
		 WHERE c.document_id = $1 AND c.patient_id = $2 AND ${CURRENT_VERSION}
		   AND ${scope === 'doctor' ? DOCTOR_VISIBLE : 'TRUE'}
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
 * Validate an edit. Only fields that are present in the body change.
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

/** Who is acting. Defaults to the patient who owns the record. */
const actorOf = (ctx) => ctx.actor ?? { type: 'patient', id: ctx.patientId };

/** Load one current finding of this patient and document that the actor may act on, locked for update. */
const loadCurrent = async (client, patientId, documentId, findingId, actor) => {
	const { rows } = await client.query(
		`SELECT c.*, to_char(c.event_date, 'YYYY-MM-DD') AS event_date
		 FROM claims c
		 WHERE c.id = $1 AND c.document_id = $2 AND c.patient_id = $3 AND ${CURRENT_VERSION}
		   AND ${actor.type === 'doctor' ? DOCTOR_VISIBLE : 'TRUE'}
		 FOR UPDATE`,
		[findingId, documentId, patientId],
	);
	return rows[0] ?? null;
};

const loadFinding = async (client, id) => {
	const { rows } = await client.query(`SELECT ${FINDING_COLUMNS} FROM claims c WHERE c.id = $1`, [id]);
	return toFinding(rows[0]);
};

/**
 * Apply an edit as a new row that supersedes the current one. The document
 * quote stays attached, so the original evidence is always shown. A patient's
 * edit is their own claim (unverified); a doctor's is a doctor-verified correction (6.2.7).
 * @returns {Promise<object | null>} the new finding, or null if not found
 */
export const editFinding = async (client, ctx) => {
	const { patientId, documentId, findingId, body } = ctx;
	const actor = actorOf(ctx);
	const current = await loadCurrent(client, patientId, documentId, findingId, actor);
	if (!current) return null;
	const changes = parseFindingEdit(body, current);
	const next = { ...current, ...changes };
	if ('name' in changes) next.name_normalised = changes.name.toLowerCase().replace(/\s+/g, ' ');

	const { rows } = await client.query(
		`INSERT INTO claims (
			patient_id, document_id, category, name, name_normalised, subject, subject_relation, assertion, action,
			dose, frequency, value, unit, ref_range, date_text, event_date, date_precision, normalised,
			quote, page, quote_start, quote_end, match_type, ocr_word_boxes,
			source_type, verification_status, supersedes_id, extractor_version, review_status, reviewed_at,
			previous_review_status, author_type, author_id
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
			$19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
		) RETURNING id`,
		[
			next.patient_id, next.document_id, next.category, next.name, next.name_normalised, next.subject, next.subject_relation,
			next.assertion, next.action, next.dose, next.frequency, next.value, next.unit, next.ref_range, next.date_text,
			next.event_date, next.date_precision, JSON.stringify({ ...(current.normalised ?? {}), edited_fields: Object.keys(changes) }),
			current.quote, current.page, current.quote_start, current.quote_end, current.match_type,
			current.ocr_word_boxes ? JSON.stringify(current.ocr_word_boxes) : null,
			actor.type === 'doctor' ? 'doctor_corrected' : 'patient_corrected',
			actor.type === 'doctor' ? 'doctor_verified' : 'unverified',
			current.id, current.extractor_version, current.review_status, current.reviewed_at,
			current.previous_review_status, actor.type, actor.id,
		],
	);
	// The original stays as evidence; marking it corrected also keeps a re-run from retiring it.
	await client.query(`UPDATE claims SET verification_status = 'corrected' WHERE id = $1 AND verification_status = 'unverified'`, [current.id]);

	return { finding: await loadFinding(client, rows[0].id), changedFields: Object.keys(changes), previousId: current.id };
};

/**
 * Remove (dismissed) or restore a finding. Nothing is deleted: removing
 * remembers the review state it had, and restoring puts it back there.
 */
export const setDismissed = async (client, ctx) => {
	const { patientId, documentId, findingId, dismissed } = ctx;
	const actor = actorOf(ctx);
	const current = await loadCurrent(client, patientId, documentId, findingId, actor);
	if (!current) return null;
	if (dismissed === (current.review_status === 'dismissed')) {
		return { finding: await loadFinding(client, current.id), wasConfirmed: false };
	}
	await client.query(
		dismissed
			? `UPDATE claims SET previous_review_status = review_status, review_status = 'dismissed', reviewed_at = now(),
			     reviewed_by_type = $2, reviewed_by_id = $3
			   WHERE id = $1`
			: `UPDATE claims SET review_status = COALESCE(previous_review_status, 'pending'), reviewed_at = now(),
			     reviewed_by_type = $2, reviewed_by_id = $3
			   WHERE id = $1`,
		[current.id, actor.type, actor.id],
	);
	const finding = await loadFinding(client, current.id);
	// The history changes when a confirmed finding is removed, or one is restored to confirmed.
	return { finding, wasConfirmed: current.review_status === 'confirmed' || finding.reviewStatus === 'confirmed' };
};

/** Add all pending findings of a document to the medical history. */
export const confirmDocument = async (client, ctx) => {
	const { patientId, documentId } = ctx;
	const actor = actorOf(ctx);
	const { rowCount } = await client.query(
		`UPDATE claims c SET review_status = 'confirmed', reviewed_at = now(), reviewed_by_type = $3, reviewed_by_id = $4
		 WHERE c.document_id = $1 AND c.patient_id = $2 AND c.review_status = 'pending' AND ${CURRENT_VERSION}`,
		[documentId, patientId, actor.type, actor.id],
	);
	return rowCount;
};
