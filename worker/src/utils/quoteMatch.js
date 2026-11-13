/**
 * Quote matching for the Quote Verifier (MVP document, section 7.2).
 *
 * Standalone utility: no dependencies, no I/O. Both the LLM quote and the page
 * text go through the SAME normalisation, then an exact substring match is
 * run on the normalised forms. An index map from every normalised character
 * back to the original text lets the caller store quote_start / quote_end
 * against the original page text, which the source viewer highlights.
 *
 * Normalisation (applied identically to both sides):
 *   1. remove soft hyphens and zero-width characters
 *   2. Unicode NFKC (per base character + its combining marks, so composition
 *      still happens and every output character maps to an original span)
 *   3. lowercase
 *   4. unify quote and dash characters
 *   5. rejoin words hyphenated across a line break ("diabe-\ntes" -> "diabetes")
 *   6. collapse whitespace and line breaks to a single space, trim the ends
 */

const SOFT_HYPHEN = '­';

// Zero-width and invisible formatting characters that PDFs and OCR leave behind.
const INVISIBLE = /[​-‍⁠﻿᠎]/u;

// Applied after NFKC, so full-width forms have already folded to ASCII.
const SINGLE_QUOTES = /[‘’‚‛′‵`´]/gu;
const DOUBLE_QUOTES = /[“”„‟″‶«»]/gu;
const DASHES = /[‐‑‒–—―−﹘﹣]/gu;

const LINE_BREAK = /[\n\r\u2028\u2029\v\f\u0085]/u;
const WHITESPACE = /\s/u;
const LETTER = /\p{L}/u;

// A base character followed by its combining marks, or a run of stray marks.
const CLUSTER = /\P{M}\p{M}*|\p{M}+/gsu;

/**
 * Hyphen at the end of a line:
 *   'join' -> drop the hyphen and the line break ("diabe-\ntes" -> "diabetes")
 *   'keep' -> keep the hyphen, drop the line break ("follow-\nup" -> "follow-up")
 * The spec asks for 'join'. findQuote() also tries 'keep' so a genuinely
 * hyphenated word that happens to wrap is not rejected.
 */
const HYPHEN_MODES = ['join', 'keep'];

const foldCharacters = (piece) =>
	piece
		.normalize('NFKC')
		.toLowerCase()
		.replace(SINGLE_QUOTES, "'")
		.replace(DOUBLE_QUOTES, '"')
		.replace(DASHES, '-');

/**
 * Turn the original text into units of { ch, start, end, ws, nl, soft }, where
 * [start, end) is the span of the original text that produced the character.
 */
const toUnits = (text) => {
	const units = [];
	for (const match of text.matchAll(CLUSTER)) {
		const raw = match[0];
		const start = match.index;
		const end = start + raw.length;

		if (raw === SOFT_HYPHEN) {
			units.push({ ch: '', start, end, ws: false, nl: false, soft: true });
			continue;
		}
		const visible = [...raw].filter((c) => !INVISIBLE.test(c)).join('');
		if (!visible) continue;

		const nl = LINE_BREAK.test(raw);
		for (const ch of foldCharacters(visible)) {
			units.push({ ch, start, end, ws: WHITESPACE.test(ch), nl, soft: false });
		}
	}
	return units;
};

/**
 * Normalise text and keep a map back to the original.
 *
 * @param {string} text
 * @param {{ hyphenBreak?: 'join' | 'keep' }} [options]
 * @returns {{ text: string, starts: number[], ends: number[] }}
 *   starts[i] / ends[i] give the original [start, end) span of normalised char i.
 */
export const normaliseWithMap = (text, { hyphenBreak = 'join' } = {}) => {
	if (typeof text !== 'string') throw new TypeError('normaliseWithMap expects a string');
	if (!HYPHEN_MODES.includes(hyphenBreak)) throw new RangeError(`Unknown hyphenBreak mode: ${hyphenBreak}`);

	const units = toUnits(text);
	const out = [];
	const starts = [];
	const ends = [];
	const push = (ch, start, end) => {
		out.push(ch);
		starts.push(start);
		ends.push(end);
	};
	const lastOutIsLetter = () => out.length > 0 && LETTER.test(out[out.length - 1]);

	let i = 0;
	while (i < units.length) {
		const unit = units[i];

		// A hyphen (or soft hyphen) followed by whitespace that contains a line break.
		if (unit.ch === '-' || unit.soft) {
			let j = i + 1;
			let sawBreak = false;
			while (j < units.length && (units[j].ws || units[j].soft)) {
				if (units[j].nl) sawBreak = true;
				j += 1;
			}
			const next = units[j];
			if (sawBreak && next && LETTER.test(next.ch) && lastOutIsLetter()) {
				if (unit.ch === '-' && hyphenBreak === 'keep') push('-', unit.start, unit.end);
				i = j;
				continue;
			}
			if (unit.soft) {
				i += 1;
				continue;
			}
		}

		if (unit.ws) {
			// Collapse a whitespace run to one space; drop it at the very start.
			let j = i;
			while (j < units.length && (units[j].ws || units[j].soft)) j += 1;
			if (out.length > 0 && j < units.length) push(' ', unit.start, units[j - 1].end);
			i = j;
			continue;
		}

		push(unit.ch, unit.start, unit.end);
		i += 1;
	}

	return { text: out.join(''), starts, ends };
};

/** Normalised string only. */
export const normaliseText = (text, options) => normaliseWithMap(text, options).text;

/**
 * Exact substring match of a quote inside a page's text, after normalising both.
 *
 * @param {string} quote     the verbatim quote returned by the LLM
 * @param {string} pageText  the stored text of the page (PDF text layer or OCR)
 * @returns {null | {
 *   start: number, end: number,          // span in the ORIGINAL page text
 *   normalisedQuote: string,
 *   occurrences: number,                 // how many times the quote appears
 *   hyphenBreak: 'join' | 'keep'
 * }}
 */
export const findQuote = (quote, pageText) => {
	if (typeof quote !== 'string' || typeof pageText !== 'string') return null;

	for (const hyphenBreak of HYPHEN_MODES) {
		const needle = normaliseText(quote, { hyphenBreak });
		if (!needle) return null;

		const haystack = normaliseWithMap(pageText, { hyphenBreak });
		const index = haystack.text.indexOf(needle);
		if (index === -1) continue;

		let occurrences = 0;
		for (let at = index; at !== -1; at = haystack.text.indexOf(needle, at + 1)) occurrences += 1;

		return {
			start: haystack.starts[index],
			end: haystack.ends[index + needle.length - 1],
			normalisedQuote: needle,
			occurrences,
			hyphenBreak,
		};
	}
	return null;
};

/**
 * True when `field` appears inside `quote` under the same normalisation.
 * Used for the "fields inside the quote" rule (field_not_in_quote).
 */
export const quoteContains = (quote, field) => {
	if (typeof quote !== 'string' || typeof field !== 'string') return false;
	return HYPHEN_MODES.some((hyphenBreak) => {
		const needle = normaliseText(field, { hyphenBreak });
		return needle.length > 0 && normaliseText(quote, { hyphenBreak }).includes(needle);
	});
};
