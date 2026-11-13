/**
 * Missing information (MVP document 8.6): gaps in what the records say.
 * Wording is "information missing", never an error and never advice.
 *
 *  - a medicine without a dose; a numeric lab result without a unit
 *  - a document with no date, or an ambiguous date (two valid readings)
 *  - medication-history flags from reconciliation: a "continue" with no
 *    earlier prescription, a medicine active again after a stop, and a
 *    medicine last documented long ago with no stop recorded
 */
import { flag, patientFindings } from './shared.js';

const NUMERIC = /^\s*[<>≤≥]?\s*\d/;

/**
 * @param {{ claims: object[], documents: object[], histories: object[] }} input
 *   documents: ready documents that have findings in the history
 *   histories: medication histories from medicationEpisodes (each with .flags)
 */
export const detect = ({ claims, documents = [], histories = [] }) => {
	const findings = patientFindings(claims);
	const flags = [];

	for (const c of findings.filter((f) => f.category === 'medication' && f.assertion === 'present' && !f.dose)) {
		flags.push(flag('missing_field', `${c.name} is recorded without a dose. Information missing.`, [c]));
	}
	for (const c of findings.filter((f) => f.category === 'investigation' && f.value && NUMERIC.test(f.value) && !f.unit)) {
		flags.push(flag('missing_field', `${c.name} result ${c.value} has no unit. Information missing.`, [c]));
	}

	for (const doc of documents) {
		if (doc.document_date) continue;
		const alternatives = doc.document_date_alternatives;
		const related = findings.filter((c) => c.document_id === doc.id);
		flags.push(
			alternatives?.length
				? flag('ambiguous_date', `The date "${doc.document_date_text}" on ${doc.original_filename} could be ${alternatives.join(' or ')}. Information missing.`, related, [doc.id])
				: flag('missing_field', `${doc.original_filename} has no date, so its findings cannot be placed in time. Information missing.`, related, [doc.id]),
		);
	}

	const byId = new Map(claims.map((c) => [c.id, c]));
	for (const history of histories) {
		for (const f of history.flags ?? []) {
			const involved = (f.claimIds ?? []).map((id) => byId.get(id)).filter(Boolean);
			flags.push(flag(f.type, f.message, involved));
		}
	}
	return flags;
};
