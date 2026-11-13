/**
 * Step 6 - Normalise dates, units and drug names (section 8.5).
 * Original values are always kept; normalisation only ADDS fields:
 *   name_normalised, event_date, date_precision, and a `normalised` object.
 * Ambiguous dates are never guessed: both readings are stored and the
 * reconciliation step raises the ambiguous-date flag.
 */
import { readFileSync } from 'node:fs';

const MONTHS = {
	jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
	jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
	oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n) => String(n).padStart(2, '0');

const validDay = (y, m, d) => {
	if (m < 1 || m > 12 || d < 1) return false;
	return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
};

const fullYear = (y, today = new Date()) => {
	if (y >= 100) return y;
	const century = Math.floor(today.getUTCFullYear() / 100) * 100;
	return century + y > today.getUTCFullYear() ? century - 100 + y : century + y;
};

const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/**
 * @param {string | null} dateText  the date as written
 * @param {{ localeHint?: 'dmy' | 'mdy' | null }} [options]
 * @returns {{ event_date: string | null, date_precision: 'day' | 'month' | 'year' | null,
 *             date_alternatives: string[] | null, ambiguous: boolean }}
 */
export const parseDate = (dateText, { localeHint = null } = {}) => {
	const none = { event_date: null, date_precision: null, date_alternatives: null, ambiguous: false };
	if (!dateText) return none;
	const text = dateText.toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
	let m;

	// 2021-05-04
	if ((m = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) {
		const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
		return validDay(y, mo, d) ? { ...none, event_date: iso(y, mo, d), date_precision: 'day' } : none;
	}

	// 04/05/2021, 4-5-21, 04.05.2021
	if ((m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) {
		const [a, b, y] = [Number(m[1]), Number(m[2]), fullYear(Number(m[3]))];
		const dmy = validDay(y, b, a) ? iso(y, b, a) : null;
		const mdy = validDay(y, a, b) ? iso(y, a, b) : null;
		if (dmy && mdy && dmy !== mdy) {
			if (localeHint === 'dmy') return { ...none, event_date: dmy, date_precision: 'day' };
			if (localeHint === 'mdy') return { ...none, event_date: mdy, date_precision: 'day' };
			return { event_date: null, date_precision: 'day', date_alternatives: [dmy, mdy], ambiguous: true };
		}
		const only = dmy || mdy;
		return only ? { ...none, event_date: only, date_precision: 'day' } : none;
	}

	// 12 Mar 2019 / 12-Mar-2019
	if ((m = text.match(/\b(\d{1,2})[\s-]([a-z]{3,9})\.?[\s-](\d{4})\b/)) && MONTHS[m[2]]) {
		const [d, mo, y] = [Number(m[1]), MONTHS[m[2]], Number(m[3])];
		return validDay(y, mo, d) ? { ...none, event_date: iso(y, mo, d), date_precision: 'day' } : none;
	}

	// Mar 12 2019
	if ((m = text.match(/\b([a-z]{3,9})\.? (\d{1,2}) (\d{4})\b/)) && MONTHS[m[1]]) {
		const [mo, d, y] = [MONTHS[m[1]], Number(m[2]), Number(m[3])];
		return validDay(y, mo, d) ? { ...none, event_date: iso(y, mo, d), date_precision: 'day' } : none;
	}

	// March 2019 / Mar-2019
	if ((m = text.match(/\b([a-z]{3,9})\.?[\s-](\d{4})\b/)) && MONTHS[m[1]]) {
		return { ...none, event_date: `${m[2]}-${pad(MONTHS[m[1]])}`, date_precision: 'month' };
	}

	// 03/2019
	if ((m = text.match(/\b(\d{1,2})[-/.](\d{4})\b/)) && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
		return { ...none, event_date: `${m[2]}-${pad(Number(m[1]))}`, date_precision: 'month' };
	}

	// 2019
	if ((m = text.match(/\b(19\d{2}|20\d{2})\b/))) {
		return { ...none, event_date: m[1], date_precision: 'year' };
	}

	return none;
};

// ---------------------------------------------------------------- drug names

const loadDrugIndex = () => {
	const dictionary = JSON.parse(readFileSync(new URL('../data/drugs.json', import.meta.url), 'utf8'));
	const index = new Map();
	for (const [generic, aliases] of Object.entries(dictionary)) {
		if (generic.startsWith('_') || !Array.isArray(aliases)) continue;
		index.set(generic, generic);
		for (const alias of aliases) index.set(alias.toLowerCase(), generic);
	}
	return index;
};

let drugIndex;

const levenshtein = (a, b) => {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i += 1) {
		let prev = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			const temp = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = temp;
		}
	}
	return row[b.length];
};

/** Strip dosage-form prefixes and strength/release suffixes: "Tab. Glycomet 500 mg SR" -> "glycomet". */
export const cleanDrugName = (name) =>
	name
		.normalize('NFKC')
		.toLowerCase()
		.replace(/^(tab|tabs|tablet|cap|caps|capsule|inj|injection|syp|syrup|susp)\.?\s+/, '')
		.replace(/\b\d+(\.\d+)?\s*(mg|mcg|µg|μg|g|ml|iu|units?|%)\b.*$/, '')
		.replace(/\b(sr|xr|er|cr|xl|od|ds|forte)\b/g, '')
		.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/**
 * @returns {{ generic: string, match: 'exact' | 'fuzzy' } | null}  null = unknown, keep as written
 */
export const matchDrug = (name) => {
	drugIndex ??= loadDrugIndex();
	const cleaned = cleanDrugName(name);
	if (!cleaned) return null;
	if (drugIndex.has(cleaned)) return { generic: drugIndex.get(cleaned), match: 'exact' };

	// Short names are too easy to confuse; only fuzzy-match longer ones, by one edit.
	if (cleaned.length < 6) return null;
	let best = null;
	for (const [alias, generic] of drugIndex) {
		if (Math.abs(alias.length - cleaned.length) > 1) continue;
		if (levenshtein(alias, cleaned) === 1) {
			if (best && best.generic !== generic) return null; // two candidates: do not guess
			best = { generic, match: 'fuzzy' };
		}
	}
	return best;
};

// ----------------------------------------------------------- units and doses

const canonicalUnit = (unit) =>
	unit
		?.normalize('NFKC')
		.toLowerCase()
		.replace(/[μu](?=mol|g\b)/g, 'µ')
		.replace(/\s+/g, '') ?? null;

// Factors checked against molar masses: glucose 180.16 g/mol, creatinine 113.12 g/mol,
// cholesterol 386.65 g/mol (1 mmol/L = 38.67 mg/dL).
const ANALYTES = [
	{ match: /glucose|blood sugar|\bfbs\b|\bppbs\b|\brbs\b/, conversions: { 'mg/dl': ['mmol/l', 1 / 18.016], 'mmol/l': ['mg/dl', 18.016] } },
	{ match: /creatinine/, conversions: { 'mg/dl': ['µmol/l', 88.42], 'µmol/l': ['mg/dl', 1 / 88.42] } },
	{ match: /^(total )?cholesterol|cholesterol,? total/, conversions: { 'mg/dl': ['mmol/l', 1 / 38.67], 'mmol/l': ['mg/dl', 38.67] } },
];

export const convertValue = (name, value, unit) => {
	const numeric = typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value) ? Number(value) : null;
	const fromUnit = canonicalUnit(unit);
	if (numeric === null || !fromUnit) return null;
	const analyte = ANALYTES.find((a) => a.match.test(name.toLowerCase()));
	const conversion = analyte?.conversions[fromUnit];
	if (!conversion) return null;
	const [toUnit, factor] = conversion;
	return { value: Math.round(numeric * factor * 100) / 100, unit: toUnit };
};

const FREQUENCIES = [
	[/\b(od|qd|once (a )?daily|once a day|daily)\b/, 1],
	[/\b(bd|bid|twice (a )?daily|twice a day)\b/, 2],
	[/\b(tds|tid|thrice daily|three times (a )?day|three times daily)\b/, 3],
	[/\b(qid|qds|four times (a )?day|four times daily)\b/, 4],
	[/\b(hs|at night|at bedtime)\b/, 1],
	[/\b(\d)\s*-\s*(\d)\s*-\s*(\d)\b/, null], // 1-0-1 style
];

export const parseDose = (dose, frequency) => {
	const result = { amount: null, unit: null, per_day: null };
	const doseMatch = dose?.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|μg|g|ml|iu|units?)\b/i);
	if (doseMatch) {
		result.amount = Number(doseMatch[1]);
		result.unit = doseMatch[2].toLowerCase().replace('μ', 'µ');
	}
	const text = `${dose ?? ''} ${frequency ?? ''}`.toLowerCase();
	for (const [pattern, perDay] of FREQUENCIES) {
		const m = text.match(pattern);
		if (!m) continue;
		result.per_day = perDay ?? Number(m[1]) + Number(m[2]) + Number(m[3]);
		break;
	}
	return result;
};

// -------------------------------------------------------------------- step 6

/**
 * @param {object[]} findings  accepted findings from step 5
 * @param {{ localeHint?: 'dmy' | 'mdy' | null }} [options]
 */
export const normalise = (findings, { localeHint = null } = {}) =>
	findings.map((finding) => {
		const date = parseDate(finding.date_text, { localeHint });
		const normalised = {};
		let nameNormalised = finding.name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

		if (finding.category === 'medication' || finding.category === 'allergy') {
			const drug = matchDrug(finding.name);
			if (drug) {
				nameNormalised = drug.generic;
				normalised.drug_match = drug.match;
			}
		}
		if (finding.category === 'medication') {
			normalised.dose = parseDose(finding.dose, finding.frequency);
		}
		if (finding.category === 'investigation') {
			const converted = convertValue(finding.name, finding.value, finding.unit);
			if (converted) normalised.converted = converted;
		}
		if (date.ambiguous) normalised.date_alternatives = date.date_alternatives;

		return {
			...finding,
			name_normalised: nameNormalised,
			event_date: date.event_date,
			date_precision: date.date_precision,
			normalised,
		};
	});
