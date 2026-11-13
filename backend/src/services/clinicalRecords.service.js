import { FINDING_COLUMNS, toFinding } from './findings.service.js';

/**
 * Doctor-entered clinical records (MVP document 6.2.8). The record itself is
 * the source of its findings, so the quote verifier does not apply. Each
 * diagnosis, prescription or investigation becomes a confirmed, doctor-verified
 * finding attributed to the doctor and dated to the consultation; free-text
 * observations stay on the record. Nothing earlier is changed.
 */

export class ClinicalRecordError extends Error {}

const ASSERTIONS = ['present', 'absent', 'possible', 'historical'];
const ACTIONS = ['start', 'continue', 'change', 'stop'];
const MAX_ITEMS = 30;

const text = (value, field, { required = false, max = 200 } = {}) => {
	if (value === undefined || value === null || value === '') {
		if (required) throw new ClinicalRecordError(`${field} is required.`);
		return null;
	}
	if (typeof value !== 'string') throw new ClinicalRecordError(`${field} must be text.`);
	const trimmed = value.trim();
	if (required && !trimmed) throw new ClinicalRecordError(`${field} is required.`);
	if (trimmed.length > max) throw new ClinicalRecordError(`${field} must be ${max} characters or fewer.`);
	return trimmed || null;
};

const list = (value, field) => {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new ClinicalRecordError(`${field} must be a list.`);
	return value;
};

/** Validate the form. @returns the record fields and the findings to create */
export const parseClinicalRecord = (body, { today = new Date().toISOString().slice(0, 10) } = {}) => {
	if (!body || typeof body !== 'object') throw new ClinicalRecordError('Send the record to add.');
	const date = body.consultationDate;
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
		throw new ClinicalRecordError('Consultation date must be a valid date (YYYY-MM-DD).');
	}
	if (date > today) throw new ClinicalRecordError('Consultation date cannot be in the future.');

	const items = [];
	list(body.diagnoses, 'diagnoses').forEach((d, i) => {
		const status = d?.status ?? 'present';
		if (!ASSERTIONS.includes(status)) throw new ClinicalRecordError(`Diagnosis ${i + 1}: status must be one of ${ASSERTIONS.join(', ')}.`);
		items.push({ category: 'condition', name: text(d?.name, `Diagnosis ${i + 1} name`, { required: true }), assertion: status });
	});
	list(body.prescriptions, 'prescriptions').forEach((p, i) => {
		const action = p?.action ?? 'start';
		if (!ACTIONS.includes(action)) throw new ClinicalRecordError(`Prescription ${i + 1}: action must be one of ${ACTIONS.join(', ')}.`);
		items.push({
			category: 'medication',
			name: text(p?.name, `Prescription ${i + 1} medicine`, { required: true }),
			assertion: 'present',
			action,
			dose: text(p?.dose, `Prescription ${i + 1} dose`),
			frequency: text(p?.frequency, `Prescription ${i + 1} frequency`),
		});
	});
	list(body.investigations, 'investigations').forEach((t, i) => {
		items.push({
			category: 'investigation',
			name: text(t?.name, `Investigation ${i + 1} test`, { required: true }),
			assertion: 'present',
			value: text(t?.value, `Investigation ${i + 1} result`),
			unit: text(t?.unit, `Investigation ${i + 1} unit`),
			ref_range: text(t?.refRange, `Investigation ${i + 1} reference range`),
		});
	});

	const observations = text(body.observations, 'Observations', { max: 4000 });
	if (!items.length && !observations) throw new ClinicalRecordError('Add at least one diagnosis, prescription, investigation or observation.');
	if (items.length > MAX_ITEMS) throw new ClinicalRecordError(`Add at most ${MAX_ITEMS} items in one record.`);

	return { consultationDate: date, facility: text(body.facility, 'Facility'), observations, items };
};

/** Insert the record and its findings inside the caller's transaction. */
export const createClinicalRecord = async (client, { patientId, doctorId, body }) => {
	const parsed = parseClinicalRecord(body);
	const { rows } = await client.query(
		`INSERT INTO clinical_records (patient_id, doctor_id, consultation_date, facility, observations)
		 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		[patientId, doctorId, parsed.consultationDate, parsed.facility, parsed.observations],
	);
	const recordId = rows[0].id;

	const ids = [];
	for (const item of parsed.items) {
		const inserted = await client.query(
			`INSERT INTO claims (
				patient_id, clinical_record_id, category, name, name_normalised, subject, assertion, action,
				dose, frequency, value, unit, ref_range, date_text, event_date, date_precision,
				source_type, verification_status, review_status, reviewed_at, reviewed_by_type, reviewed_by_id,
				author_type, author_id
			) VALUES (
				$1, $2, $3, $4, $5, 'patient', $6, $7, $8, $9, $10, $11, $12, $13, $14::date, 'day',
				'doctor_entered', 'doctor_verified', 'confirmed', now(), 'doctor', $15, 'doctor', $15
			) RETURNING id`,
			[
				patientId, recordId, item.category, item.name, item.name.toLowerCase().replace(/\s+/g, ' '), item.assertion,
				item.category === 'medication' ? item.action : null, item.dose ?? null, item.frequency ?? null,
				item.value ?? null, item.unit ?? null, item.ref_range ?? null, parsed.consultationDate, parsed.consultationDate, doctorId,
			],
		);
		ids.push(inserted.rows[0].id);
	}

	const findings = ids.length
		? (await client.query(`SELECT ${FINDING_COLUMNS} FROM claims c WHERE c.id = ANY($1::uuid[]) ORDER BY c.created_at`, [ids])).rows.map(toFinding)
		: [];
	return { id: recordId, consultationDate: parsed.consultationDate, facility: parsed.facility, observations: parsed.observations, findings };
};
