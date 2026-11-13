/**
 * Possible duplicates (MVP document 8.6): the same finding and date in
 * different documents, for example one lab result printed in two reports.
 * Flagged for review with every source kept; never merged silently.
 */
import { dateOf, doseKey, flag, groupBy, pairs, patientFindings, resultKey } from './shared.js';

export const detect = ({ claims }) => {
	const findings = patientFindings(claims).filter((c) => c.document_id);
	const flags = [];

	const sameKey = (c) => {
		const date = dateOf(c);
		if (!date) return null;
		if (c.category === 'investigation' && resultKey(c)) return `test:${c.name_normalised}@${date}=${resultKey(c)}`;
		if (c.category === 'medication' && doseKey(c)) return `med:${c.name_normalised}@${date}=${doseKey(c)}`;
		return null;
	};

	for (const group of groupBy(findings, sameKey).values()) {
		for (const [a, b] of pairs(group)) {
			if (a.document_id === b.document_id) continue;
			const what = a.category === 'investigation' ? `${a.name} ${[a.value, a.unit].filter(Boolean).join(' ')}` : `${a.name} ${a.dose}`;
			flags.push(flag('duplicate', `Possible duplicate: ${what} on ${dateOf(a)} appears in two documents.`, [a, b]));
		}
	}
	return flags;
};
