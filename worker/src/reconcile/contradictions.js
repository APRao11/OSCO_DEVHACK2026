/**
 * Contradictions (MVP document 8.6): records that disagree. Never resolved
 * automatically; a doctor reviews both versions side by side.
 *
 *  - an allergy recorded as present in one document and as absent in another
 *    (including a later "no known drug allergies" general statement)
 *  - the same condition or allergy documented as present and as absent
 *  - two different doses for the same medicine on the same date
 *  - incompatible results for the same test on the same date
 *
 * Possible and family findings are never contradictions (7.3 rule 6).
 */
import { dateOf, doseKey, flag, groupBy, pairs, patientFindings, resultKey } from './shared.js';

const GENERAL_STATEMENT = /general statement/i;
const fmt = (iso) => iso ?? 'an undated record';

export const detect = ({ claims }) => {
	const findings = patientFindings(claims).filter((c) => c.assertion !== 'possible');
	const flags = [];

	// Allergy present vs a general "no known drug allergies" statement in another document.
	const allergies = findings.filter((c) => c.category === 'allergy');
	const generalAbsent = allergies.filter((c) => c.assertion === 'absent' && GENERAL_STATEMENT.test(c.name));
	for (const present of allergies.filter((c) => c.assertion === 'present')) {
		for (const absent of generalAbsent) {
			if (present.document_id && present.document_id === absent.document_id) continue;
			flags.push(
				flag(
					'contradiction',
					`An allergy to ${present.name} is recorded, but another record says there are no known drug allergies. Records disagree, needs review.`,
					[present, absent],
				),
			);
		}
	}

	// The same condition or allergy recorded as present and as absent.
	const byName = groupBy(
		findings.filter((c) => (c.category === 'condition' || c.category === 'allergy') && !GENERAL_STATEMENT.test(c.name)),
		(c) => `${c.category}:${c.name_normalised}`,
	);
	for (const group of byName.values()) {
		for (const present of group.filter((c) => c.assertion === 'present')) {
			for (const absent of group.filter((c) => c.assertion === 'absent')) {
				flags.push(
					flag('contradiction', `${present.name} is recorded as present in one record and as absent in another. Records disagree, needs review.`, [present, absent]),
				);
			}
		}
	}

	// Two doses for the same medicine on the same date.
	const medicines = groupBy(
		findings.filter((c) => c.category === 'medication' && doseKey(c) && dateOf(c)),
		(c) => `${c.name_normalised}@${dateOf(c)}`,
	);
	for (const group of medicines.values()) {
		for (const [a, b] of pairs(group)) {
			if (doseKey(a) !== doseKey(b)) {
				flags.push(
					flag('contradiction', `${a.name} is recorded with two different doses (${a.dose} and ${b.dose}) on ${fmt(dateOf(a))}. Records disagree, needs review.`, [a, b]),
				);
			}
		}
	}

	// Different results for the same test on the same date.
	const tests = groupBy(
		findings.filter((c) => c.category === 'investigation' && resultKey(c) && dateOf(c)),
		(c) => `${c.name_normalised}@${dateOf(c)}`,
	);
	for (const group of tests.values()) {
		for (const [a, b] of pairs(group)) {
			if (resultKey(a) !== resultKey(b)) {
				flags.push(
					flag(
						'contradiction',
						`${a.name} has two different results on ${fmt(dateOf(a))}: ${[a.value, a.unit].filter(Boolean).join(' ')} and ${[b.value, b.unit].filter(Boolean).join(' ')}. Records disagree, needs review.`,
						[a, b],
					),
				);
			}
		}
	}

	return flags;
};
