/**
 * Medication histories (MVP document section 8.6). Plain, deterministic code:
 * the same findings in always give the same histories out.
 *
 * Per normalised drug, findings are sorted by event date (fallback: document
 * date, marked as such), then:
 *   start                       -> open an episode
 *   change                      -> close the current dose segment, open a new one
 *   stop                        -> close the episode with the stop date and source
 *   active mention after a stop -> new episode + flag
 * End status:
 *   explicit stop               -> "Stopped on <date>"
 *   last evidence is active     -> "Last documented active on <date>" (source),
 *                                  may be outdated once older than the set period (default 6 months)
 *
 * Flags list the findings involved and are never resolved automatically.
 * No interaction, dose-advice or treatment logic is built here.
 */

export const DEFAULT_STALE_AFTER_MONTHS = 6;

export const FLAG_TYPES = Object.freeze({
	ACTIVE_AFTER_STOP: 'active_after_stop',
	ORPHAN_REFERENCE: 'orphan_reference',
	STALE_MEDICATION: 'stale_medication',
});

/** 'YYYY-MM-DD' from a Date (pg returns DATE columns as local-midnight Dates) or a string. */
export const toIsoDate = (value) => {
	if (!value) return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		const pad = (n) => String(n).padStart(2, '0');
		return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
	}
	const match = String(value).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
	if (!match) return null;
	return `${match[1]}-${match[2] ?? '01'}-${match[3] ?? '01'}`;
};

const monthsBetween = (fromIso, toIso) => {
	const [fy, fm, fd] = fromIso.split('-').map(Number);
	const [ty, tm, td] = toIso.split('-').map(Number);
	return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
};

/** Comparable dose key, or null when the dose is unknown (an unknown dose never implies a change). */
const doseKey = (claim) => {
	const dose = claim.normalised?.dose;
	if (dose?.amount != null && dose.unit) {
		return `${dose.amount} ${dose.unit}${dose.per_day != null ? ` x${dose.per_day}/day` : ''}`;
	}
	return claim.dose ? claim.dose.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : null;
};

/**
 * Where a finding sits in time.
 * @returns {{ date: string | null, precision: string | null, dateSource: 'event' | 'document' | null }}
 */
const placeInTime = (claim) => {
	const eventDate = toIsoDate(claim.event_date);
	if (eventDate) return { date: eventDate, precision: claim.date_precision ?? 'day', dateSource: 'event' };
	const documentDate = toIsoDate(claim.document_date);
	if (documentDate) return { date: documentDate, precision: 'day', dateSource: 'document' };
	return { date: null, precision: null, dateSource: null };
};

const ACTION_ORDER = { start: 0, change: 1, continue: 2, none: 2, stop: 3 };

const compareEntries = (a, b) =>
	a.date.localeCompare(b.date) ||
	(ACTION_ORDER[a.action] ?? 2) - (ACTION_ORDER[b.action] ?? 2) ||
	String(a.claim.document_id ?? '').localeCompare(String(b.claim.document_id ?? '')) ||
	(a.claim.quote_start ?? 0) - (b.claim.quote_start ?? 0) ||
	String(a.claim.id ?? '').localeCompare(String(b.claim.id ?? ''));

const evidenceOf = (entry) => ({
	claimId: entry.claim.id ?? null,
	date: entry.date,
	datePrecision: entry.precision,
	dateSource: entry.dateSource,
	action: entry.action,
	dose: entry.claim.dose ?? null,
	frequency: entry.claim.frequency ?? null,
});

/**
 * Build the history of one drug from its dated, sorted findings.
 * @param {string} drug
 * @param {object[]} entries  [{ claim, action, date, precision, dateSource }], sorted
 * @param {{ asOf: string, staleAfterMonths: number }} options
 */
const buildDrugHistory = (drug, entries, { asOf, staleAfterMonths }) => {
	const episodes = [];
	const flags = [];
	let open = null; // the episode currently open, if any

	const openEpisode = (entry, { startKnown }) => {
		open = {
			start: startKnown ? evidenceOf(entry) : null,
			firstEvidence: evidenceOf(entry),
			end: null,
			segments: [{ dose: entry.claim.dose ?? null, frequency: entry.claim.frequency ?? null, doseKey: doseKey(entry.claim), from: evidenceOf(entry), to: null }],
			evidence: [evidenceOf(entry)],
		};
		episodes.push(open);
	};

	const currentSegment = () => open.segments[open.segments.length - 1];

	const changeDose = (entry) => {
		currentSegment().to = evidenceOf(entry);
		open.segments.push({ dose: entry.claim.dose ?? null, frequency: entry.claim.frequency ?? null, doseKey: doseKey(entry.claim), from: evidenceOf(entry), to: null });
	};

	for (const entry of entries) {
		const { action } = entry;
		const hadEpisodeBefore = episodes.length > 0;

		if (!open) {
			if (action === 'stop') {
				// A stop with no known start: record it as an episode that only has an end.
				openEpisode(entry, { startKnown: false });
				open.end = evidenceOf(entry);
				currentSegment().to = evidenceOf(entry);
				flags.push({
					type: FLAG_TYPES.ORPHAN_REFERENCE,
					message: `A record stops ${drug}, but no earlier record of it was found. Information missing.`,
					claimIds: [entry.claim.id ?? null],
				});
				open = null;
				continue;
			}

			openEpisode(entry, { startKnown: action === 'start' });

			if (hadEpisodeBefore) {
				const previousEnd = episodes[episodes.length - 2].end;
				flags.push({
					type: FLAG_TYPES.ACTIVE_AFTER_STOP,
					message: `${drug} is recorded as active after it was recorded as stopped. Records disagree, needs review.`,
					claimIds: [previousEnd?.claimId ?? null, entry.claim.id ?? null],
				});
			} else if (action === 'continue' || action === 'change') {
				flags.push({
					type: FLAG_TYPES.ORPHAN_REFERENCE,
					message: `A record says to ${action} ${drug}, but no earlier prescription was found. Information missing.`,
					claimIds: [entry.claim.id ?? null],
				});
			}
			continue;
		}

		open.evidence.push(evidenceOf(entry));

		if (action === 'stop') {
			open.end = evidenceOf(entry);
			currentSegment().to = evidenceOf(entry);
			open = null;
			continue;
		}

		// change, or any active mention whose known dose differs from the current one
		const key = doseKey(entry.claim);
		const current = currentSegment();
		if (action === 'change' || (key && current.doseKey && key !== current.doseKey)) {
			changeDose(entry);
		} else if (key && !current.doseKey) {
			// The dose was unknown so far; this finding supplies it without implying a change.
			current.dose = entry.claim.dose ?? null;
			current.frequency = entry.claim.frequency ?? null;
			current.doseKey = key;
		}
	}

	// End status from the last episode.
	const last = episodes[episodes.length - 1];
	let status;
	if (last.end) {
		status = { state: 'stopped', label: `Stopped on ${last.end.date}`, date: last.end.date, source: last.end };
	} else {
		const lastEvidence = last.evidence[last.evidence.length - 1];
		const ageMonths = monthsBetween(lastEvidence.date, asOf);
		const possiblyOutdated = ageMonths >= staleAfterMonths;
		status = {
			state: 'last_documented_active',
			label: `Last documented active on ${lastEvidence.date}`,
			date: lastEvidence.date,
			source: lastEvidence,
			ageMonths,
			possiblyOutdated,
		};
		if (possiblyOutdated) {
			flags.push({
				type: FLAG_TYPES.STALE_MEDICATION,
				message: `${drug} was last documented active ${ageMonths} month(s) ago and no stop is recorded. Information missing.`,
				claimIds: [lastEvidence.claimId],
			});
		}
	}

	return {
		drug,
		episodes: episodes.map(({ segments, ...episode }) => ({
			...episode,
			segments: segments.map(({ doseKey: _key, ...segment }) => segment),
		})),
		status,
		flags,
	};
};

/**
 * Reconcile a patient's medication findings into per-drug histories.
 *
 * @param {object[]} claims  accepted findings (claims rows). Uses: id, category,
 *   subject, assertion, action, name, name_normalised, dose, frequency,
 *   normalised.dose, event_date, date_precision, document_date, document_id, quote_start
 * @param {{ asOf?: Date | string, staleAfterMonths?: number }} [options]
 * @returns {{ histories: object[], undated: object[], notCounted: object[] }}
 *   histories: one per drug, sorted by drug name
 *   undated:   medication findings with no event or document date (cannot be placed in time)
 *   notCounted: absent/possible medication findings, kept out of episodes
 */
export const reconcileMedications = (claims, { asOf = new Date(), staleAfterMonths = DEFAULT_STALE_AFTER_MONTHS } = {}) => {
	const asOfIso = toIsoDate(asOf);
	const byDrug = new Map();
	const undated = [];
	const notCounted = [];

	for (const claim of claims) {
		if (claim.category !== 'medication' || claim.subject !== 'patient') continue;
		if (claim.retired_at || claim.verification_status === 'rejected') continue;

		// Only present or historical findings say the patient took the medicine.
		if (claim.assertion !== 'present' && claim.assertion !== 'historical') {
			notCounted.push({ claimId: claim.id ?? null, drug: claim.name_normalised ?? claim.name, assertion: claim.assertion });
			continue;
		}

		const drug = (claim.name_normalised || claim.name || '').trim();
		if (!drug) continue;

		const placed = placeInTime(claim);
		if (!placed.date) {
			undated.push({ claimId: claim.id ?? null, drug, action: claim.action ?? 'none' });
			continue;
		}

		const entry = { claim, action: claim.action ?? 'none', ...placed };
		if (!byDrug.has(drug)) byDrug.set(drug, []);
		byDrug.get(drug).push(entry);
	}

	const histories = [...byDrug.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([drug, entries]) => buildDrugHistory(drug, entries.sort(compareEntries), { asOf: asOfIso, staleAfterMonths }));

	return { histories, undated, notCounted };
};

/**
 * Reconcile hook called by jobs/reconcilePatient.js inside its transaction.
 * The curated table is rebuilt from scratch for this patient on every run.
 */
export const run = async ({ client, patientId, claims }) => {
	const { histories, undated } = reconcileMedications(claims);

	// Drugs seen only in undated findings still get a row, with no episodes.
	const dated = new Set(histories.map((history) => history.drug));
	const undatedOnly = [...new Set(undated.map((item) => item.drug))]
		.filter((drug) => !dated.has(drug))
		.map((drug) => ({ drug, episodes: [], status: { state: 'undated_only', label: 'Mentioned without a date' }, flags: [] }));

	await client.query('DELETE FROM medication_histories WHERE patient_id = $1', [patientId]);
	for (const history of [...histories, ...undatedOnly]) {
		const undatedForDrug = undated.filter((item) => item.drug === history.drug);
		await client.query(
			'INSERT INTO medication_histories (patient_id, drug, history) VALUES ($1, $2, $3)',
			[patientId, history.drug, JSON.stringify({ ...history, undated: undatedForDrug })],
		);
	}
	return histories;
};
