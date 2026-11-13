/**
 * Step 3 - Classify: prescription, lab report, discharge summary, ...
 * Deterministic keyword scoring over the page text. The result is stored on the
 * document and passed to the extraction prompt as context; it never decides
 * what counts as a fact.
 */

export const DOCUMENT_TYPES = [
	'prescription',
	'lab_report',
	'discharge_summary',
	'imaging_report',
	'clinical_note',
	'other',
];

const SIGNALS = {
	prescription: [/\bprescription\b/, /\brx\b/, /\btab(let)?s?\.?\s/, /\bcap(sule)?s?\.?\s/, /\b(od|bd|tds|qid|hs|sos)\b/, /\bonce daily\b/, /\btwice daily\b/, /\bdispense\b/],
	lab_report: [/\blaborator(y|ies)\b/, /\blab report\b/, /\breference (range|interval)\b/, /\bspecimen\b/, /\bsample (collected|type)\b/, /\bhaemoglobin|hemoglobin\b/, /\bmg\/dl\b/, /\bmmol\/l\b/],
	discharge_summary: [/\bdischarge summary\b/, /\bdate of (admission|discharge)\b/, /\badmitted\b/, /\bdischarged\b/, /\bcourse in hospital\b/, /\bhospital course\b/],
	imaging_report: [/\bradiolog(y|ist)\b/, /\bx-?ray\b/, /\bultrasound\b/, /\b(ct|mri) (scan|brain|abdomen|chest)\b/, /\bimpression\b/, /\bfindings\b/],
	clinical_note: [/\bchief complaint\b/, /\bhistory of present illness\b/, /\bexamination\b/, /\bassessment\b/, /\bplan\b/, /\bconsultation\b/, /\bfollow-?up\b/],
};

// The title on the first page is strong evidence, so it counts extra.
const TITLE_WEIGHT = 3;

/**
 * @param {{ text: string }[]} pages
 * @returns {{ documentType: string, scores: Record<string, number> }}
 */
export const classify = (pages) => {
	const all = pages.map((page) => page.text).join('\n').toLowerCase();
	const head = (pages[0]?.text || '').slice(0, 400).toLowerCase();

	const scores = {};
	for (const [type, patterns] of Object.entries(SIGNALS)) {
		scores[type] = patterns.reduce(
			(score, pattern) => score + (pattern.test(all) ? 1 : 0) + (pattern.test(head) ? TITLE_WEIGHT - 1 : 0),
			0,
		);
	}

	const [best, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
	return { documentType: bestScore >= 2 ? best : 'other', scores };
};
