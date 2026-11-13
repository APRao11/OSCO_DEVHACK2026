/**
 * Helpers shared by the flag rules (MVP document 8.6). Plain functions over
 * claims rows as reconcilePatient loads them (snake_case, pg types).
 */
import { toIsoDate } from './medicationEpisodes.js';

export { toIsoDate };

/** Findings that describe the patient (family and other people never raise flags). */
export const patientFindings = (claims) => claims.filter((c) => c.subject === 'patient');

/** The date a finding is placed at: its own event date, else its document's date. */
export const dateOf = (claim) => toIsoDate(claim.event_date) ?? toIsoDate(claim.document_date) ?? null;

const squash = (text) => (text ?? '').toString().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

/** Comparable dose: normalised amount/unit/per-day when parsed, else the text as written. */
export const doseKey = (claim) => {
	const dose = claim.normalised?.dose;
	if (dose?.amount != null && dose.unit) return `${dose.amount} ${dose.unit}${dose.per_day != null ? ` x${dose.per_day}` : ''}`;
	return claim.dose ? squash(claim.dose) : null;
};

/** Comparable lab result: value + unit as written (no conversion, no interpretation). */
export const resultKey = (claim) => (claim.value ? `${squash(claim.value)} ${squash(claim.unit)}`.trim() : null);

export const label = (claim) => claim.name;

/** Group items by a key, skipping items whose key is null. */
export const groupBy = (items, keyOf) => {
	const groups = new Map();
	for (const item of items) {
		const key = keyOf(item);
		if (key == null) continue;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(item);
	}
	return groups;
};

/** Every unordered pair of an array. */
export const pairs = (items) => items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b]));

/** A flag as the rules return it; the store adds the fingerprint and status. */
export const flag = (type, message, claims, documentIds = []) => ({
	type,
	message,
	findingIds: [...new Set(claims.map((c) => c.id).filter(Boolean))],
	documentIds: [...new Set([...documentIds, ...claims.map((c) => c.document_id).filter(Boolean)])],
});
