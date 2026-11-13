/**
 * Step 5 - Verify: the Quote Verifier / fake-fact blocker (section 7.2).
 *
 * Pure function: no database, no network. Every finding the LLM returned ends
 * up either accepted (with its evidence span) or rejected (with a reason).
 * A rejection is not a job failure.
 *
 *   1. Required output        -> schema_invalid
 *   2. Normalise both sides   -> utils/quoteMatch.js (NFKC, lowercase, whitespace,
 *                                quotes/dashes, soft hyphens, zero-width, line-break hyphens)
 *   3. Exact substring match  -> quote_not_found; a wrong page is corrected if the
 *                                quote is on another page of the same document
 *   4. Sensible length        -> quote_length (8 to 300 normalised characters)
 *   5. Fields inside quote    -> field_not_in_quote
 *   6. Keep the evidence      -> page, quote_start, quote_end, OCR word boxes
 *   7. Keep the rejected ones -> returned with the raw finding and the reason
 *   8. Approximate matching   -> not implemented (optional, off by default in the spec)
 */
import { findQuote, normaliseText, quoteContains } from '../utils/quoteMatch.js';

export const REJECTION_REASONS = Object.freeze({
	SCHEMA_INVALID: 'schema_invalid',
	QUOTE_LENGTH: 'quote_length',
	QUOTE_NOT_FOUND: 'quote_not_found',
	FIELD_NOT_IN_QUOTE: 'field_not_in_quote',
});

const CATEGORIES = ['condition', 'medication', 'allergy', 'investigation', 'event'];
const SUBJECTS = ['patient', 'family', 'other'];
const ASSERTIONS = ['present', 'absent', 'possible', 'historical'];
const ACTIONS = ['start', 'continue', 'change', 'stop', 'none'];
const TEXT_FIELDS = ['name', 'subject_relation', 'dose', 'frequency', 'value', 'unit', 'ref_range', 'date_text', 'quote'];

// Section 5 of 7.2: these must appear inside the quote.
export const FIELDS_IN_QUOTE = ['name', 'dose', 'value', 'unit', 'date_text'];

// Section 7.3: "no known drug allergies" is stored under a fixed general name
// that by design does not appear in the quote, so it is exempt from the name check.
const GENERAL_STATEMENT = /,\s*general statement$/i;

const trimmedOrNull = (value) => {
	if (value === undefined || value === null) return null;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value !== 'string') return undefined; // signals "wrong type"
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
};

const enumValue = (value, allowed) => {
	const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
	return allowed.includes(v) ? v : undefined;
};

/**
 * Validate and tidy one raw finding.
 * @returns {{ ok: true, finding: object } | { ok: false, detail: string }}
 */
export const validateFinding = (raw) => {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, detail: 'finding is not an object' };

	const finding = {};
	for (const field of TEXT_FIELDS) {
		const value = trimmedOrNull(raw[field]);
		if (value === undefined) return { ok: false, detail: `${field} must be a string or null` };
		finding[field] = value;
	}

	if (!finding.quote) return { ok: false, detail: 'quote is missing' };

	const page = typeof raw.page === 'string' && /^\d+$/.test(raw.page.trim()) ? Number(raw.page) : raw.page;
	if (!Number.isInteger(page) || page < 1) return { ok: false, detail: 'page is missing or not a positive integer' };
	finding.page = page;

	if (!finding.name) return { ok: false, detail: 'name is missing' };

	finding.category = enumValue(raw.category, CATEGORIES);
	if (!finding.category) return { ok: false, detail: `category must be one of ${CATEGORIES.join(', ')}` };

	finding.subject = enumValue(raw.subject, SUBJECTS);
	if (!finding.subject) return { ok: false, detail: `subject must be one of ${SUBJECTS.join(', ')}` };

	finding.assertion = enumValue(raw.assertion, ASSERTIONS);
	if (!finding.assertion) return { ok: false, detail: `assertion must be one of ${ASSERTIONS.join(', ')}` };

	if (finding.category === 'medication') {
		if (raw.action === undefined || raw.action === null) finding.action = 'none';
		else {
			finding.action = enumValue(raw.action, ACTIONS);
			if (!finding.action) return { ok: false, detail: `action must be one of ${ACTIONS.join(', ')}` };
		}
	} else {
		finding.action = null; // "Medicines only"
	}

	return { ok: true, finding };
};

/** Pages to try: the stated page first, then the others in order. */
const searchOrder = (statedPage, pages) => {
	const stated = pages.find((page) => page.pageNumber === statedPage);
	return stated ? [stated, ...pages.filter((page) => page !== stated)] : [...pages];
};

/** OCR word boxes that overlap [start, end) of the page text. */
const wordsInSpan = (page, start, end) => {
	const words = page.ocrWords?.words;
	if (!Array.isArray(words)) return null;
	return words.filter((word) => word.start < end && word.end > start);
};

/**
 * @param {object[]} rawFindings  findings exactly as the LLM returned them
 * @param {{ pageNumber: number, text: string, source?: string, ocrWords?: object }[]} pages
 * @param {{ minQuoteChars?: number, maxQuoteChars?: number }} [options]
 * @returns {{ accepted: object[], rejected: object[], stats: object }}
 */
export const verifyFindings = (rawFindings, pages, { minQuoteChars = 8, maxQuoteChars = 300 } = {}) => {
	const accepted = [];
	const rejected = [];
	const stats = {
		returned: 0,
		accepted: 0,
		rejected: 0,
		rejectedByReason: Object.fromEntries(Object.values(REJECTION_REASONS).map((reason) => [reason, 0])),
		pageCorrections: 0,
		approximateMatches: 0,
		multipleOccurrences: 0,
		/** Findings kept without a date because their date was not in their quote */
		datesDropped: 0,
	};

	const reject = (raw, reason, detail) => {
		rejected.push({ reason, detail, raw });
		stats.rejected += 1;
		stats.rejectedByReason[reason] += 1;
	};

	for (const raw of Array.isArray(rawFindings) ? rawFindings : []) {
		stats.returned += 1;

		// 1. Required output
		const validation = validateFinding(raw);
		if (!validation.ok) {
			reject(raw, REJECTION_REASONS.SCHEMA_INVALID, validation.detail);
			continue;
		}
		const finding = validation.finding;

		// 4. Sensible length (measured on the normalised quote)
		const quoteLength = normaliseText(finding.quote).length;
		if (quoteLength < minQuoteChars || quoteLength > maxQuoteChars) {
			reject(raw, REJECTION_REASONS.QUOTE_LENGTH, `quote is ${quoteLength} characters; allowed ${minQuoteChars} to ${maxQuoteChars}`);
			continue;
		}

		// 2 + 3. Normalise both sides, exact substring match, correct the page if needed
		let match = null;
		let matchedPage = null;
		for (const page of searchOrder(finding.page, pages)) {
			match = findQuote(finding.quote, page.text ?? '');
			if (match) {
				matchedPage = page;
				break;
			}
		}
		if (!match) {
			reject(raw, REJECTION_REASONS.QUOTE_NOT_FOUND, `quote not found on page ${finding.page} or any other page`);
			continue;
		}

		// 5. Fields inside the quote
		const missing = FIELDS_IN_QUOTE.filter((field) => {
			const value = finding[field];
			if (!value) return false;
			if (field === 'name' && GENERAL_STATEMENT.test(value)) return false;
			return !quoteContains(finding.quote, value);
		});
		// A date that is not in the quote is usually the document's header date copied onto
		// each row (e.g. a lab report's collection date). The finding never claims that date:
		// it is dropped, the finding stays undated and falls back to the verified document
		// date. The facts themselves (name, dose, value, unit) must still be in the quote.
		if (missing.length === 1 && missing[0] === 'date_text') {
			finding.date_text = null;
			stats.datesDropped += 1;
		} else if (missing.length) {
			reject(raw, REJECTION_REASONS.FIELD_NOT_IN_QUOTE, `not in quote: ${missing.join(', ')}`);
			continue;
		}

		// 6. Keep the evidence
		const pageCorrected = matchedPage.pageNumber !== finding.page;
		if (pageCorrected) stats.pageCorrections += 1;
		if (match.occurrences > 1) stats.multipleOccurrences += 1;

		accepted.push({
			...finding,
			llm_quote: finding.quote,
			quote: matchedPage.text.slice(match.start, match.end), // the page's own text
			stated_page: finding.page,
			page: matchedPage.pageNumber,
			page_corrected: pageCorrected,
			quote_start: match.start,
			quote_end: match.end,
			match_type: 'exact',
			ocr_word_boxes: wordsInSpan(matchedPage, match.start, match.end),
			raw,
		});
		stats.accepted += 1;
	}

	return { accepted, rejected, stats };
};

/**
 * Verify the model's document date claim the same way as a finding: its quote
 * must be on a page of this document (exact match after normalisation) and the
 * date must be inside that quote. Otherwise the document is treated as undated.
 *
 * @param {{ date_text?: unknown, quote?: unknown, page?: unknown } | null} claim
 * @returns {{ ok: true, date_text: string, quote: string, page: number, quote_start: number, quote_end: number }
 *         | { ok: false, reason: string }}
 */
export const verifyDocumentDate = (claim, pages) => {
	if (!claim) return { ok: false, reason: 'no document date given' };
	const dateText = typeof claim.date_text === 'string' ? claim.date_text.trim() : '';
	const quote = typeof claim.quote === 'string' ? claim.quote.trim() : '';
	if (!dateText || !quote) return { ok: false, reason: 'document date without date_text or quote' };
	if (!quoteContains(quote, dateText)) return { ok: false, reason: 'document date not inside its quote' };

	const stated = Number.isInteger(claim.page) ? claim.page : Number(claim.page);
	for (const page of searchOrder(stated, pages)) {
		const match = findQuote(quote, page.text ?? '');
		if (match) {
			return {
				ok: true,
				date_text: dateText,
				quote: page.text.slice(match.start, match.end),
				page: page.pageNumber,
				quote_start: match.start,
				quote_end: match.end,
			};
		}
	}
	return { ok: false, reason: 'document date quote not found in the document' };
};
