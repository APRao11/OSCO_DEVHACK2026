import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { findQuote, normaliseText, normaliseWithMap, quoteContains } from '../src/utils/quoteMatch.js';
import { verifyFindings } from '../src/pipeline/5-verify.js';

describe('normaliseText', () => {
	test('applies NFKC (ligatures, full-width, non-breaking space)', () => {
		assert.equal(normaliseText('ﬁbrosis'), 'fibrosis');
		assert.equal(normaliseText('ＨｂＡ１ｃ'), 'hba1c');
		assert.equal(normaliseText('500 mg'), '500 mg');
	});

	test('composes decomposed accents the same way as precomposed ones', () => {
		assert.equal(normaliseText('Sjögren'), normaliseText('Sjögren'));
	});

	test('lowercases and collapses whitespace and line breaks', () => {
		assert.equal(normaliseText('  Metformin\t500 mg\r\n\n twice   daily  '), 'metformin 500 mg twice daily');
	});

	test('unifies quote and dash characters', () => {
		assert.equal(normaliseText('patient’s “known” 2019–2021 — BP'), 'patient\'s "known" 2019-2021 - bp');
	});

	test('removes soft hyphens and zero-width characters', () => {
		assert.equal(normaliseText('hyper­tension'), 'hypertension');
		assert.equal(normaliseText('amlo​dipine﻿'), 'amlodipine');
	});

	test('rejoins a word hyphenated across a line break', () => {
		assert.equal(normaliseText('known diabe-\ntes mellitus'), 'known diabetes mellitus');
		assert.equal(normaliseText('known diabe­\r\n  tes'), 'known diabetes');
		assert.equal(normaliseText('follow-\nup', { hyphenBreak: 'keep' }), 'follow-up');
	});

	test('keeps a hyphen that is not at a line break', () => {
		assert.equal(normaliseText('follow-up in 2-3 weeks'), 'follow-up in 2-3 weeks');
	});

	test('index map points every normalised character back to the original', () => {
		const original = '  Tab. ﬁlgrastim\n';
		const { text, starts, ends } = normaliseWithMap(original);
		assert.equal(text, 'tab. filgrastim');
		assert.equal(starts.length, text.length);
		// "f" and "i" both come from the single ligature character at index 7
		assert.equal(original.slice(starts[5], ends[6]), 'ﬁ');
	});
});

describe('findQuote (exact substring match)', () => {
	const page = 'DISCHARGE SUMMARY\nDiagnosis: Type 2 diabe-\ntes mellitus.\nStarted Tab. Metformin 500 mg twice daily on 12 Mar 2019.';

	test('matches after normalising both sides and returns the original span', () => {
		const match = findQuote('Started tab. metformin 500 mg  twice daily', page);
		assert.ok(match);
		assert.equal(page.slice(match.start, match.end), 'Started Tab. Metformin 500 mg twice daily');
	});

	test('matches across a hyphenated line break', () => {
		const match = findQuote('Type 2 diabetes mellitus', page);
		assert.ok(match);
		assert.equal(page.slice(match.start, match.end), 'Type 2 diabe-\ntes mellitus');
	});

	test('normalises the LLM quote too (curly quotes, NFKC, soft hyphen)', () => {
		const text = 'Allergy: "Penicillin" - rash';
		assert.ok(findQuote('Allergy: “Penicillin” – rash', text));
		assert.ok(findQuote('Allergy: “Peni­cillin” – rash', text));
	});

	test('a genuinely hyphenated word that wraps still matches its hyphenated quote', () => {
		const match = findQuote('Review at follow-up visit', 'Review at follow-\nup visit');
		assert.ok(match);
		assert.equal(match.hyphenBreak, 'keep');
	});

	test('rejects text that is not on the page', () => {
		assert.equal(findQuote('Metformin 1000 mg twice daily', page), null);
		assert.equal(findQuote('', page), null);
	});

	test('is exact, not fuzzy', () => {
		assert.equal(findQuote('Metformin 500 mg twice dialy', page), null);
	});

	test('counts repeated occurrences', () => {
		assert.equal(findQuote('no known allergies', 'No known allergies. ... No known allergies.').occurrences, 2);
	});
});

describe('quoteContains', () => {
	test('checks fields under the same normalisation', () => {
		assert.ok(quoteContains('Metformin 500 mg twice daily', '500 mg'));
		assert.ok(!quoteContains('Metformin 500 mg twice daily', '1000 mg'));
	});
});

describe('verifyFindings (Quote Verifier, section 7.2)', () => {
	const pages = [
		{ pageNumber: 1, text: 'Lab Report\nFasting Glucose 126 mg/dL (70-99)\nDate: 04/05/2021' },
		{ pageNumber: 2, text: 'Medications:\nTab. Glycomet 500 mg twice daily\nNo known drug allergies.' },
	];

	const base = {
		category: 'medication',
		name: 'Glycomet',
		subject: 'patient',
		subject_relation: null,
		assertion: 'present',
		action: 'continue',
		dose: '500 mg',
		frequency: 'twice daily',
		value: null,
		unit: null,
		ref_range: null,
		date_text: null,
		quote: 'Tab. Glycomet 500 mg twice daily',
		page: 2,
	};

	test('accepts a finding whose quote is on the stated page and records the span', () => {
		const { accepted, rejected, stats } = verifyFindings([base], pages);
		assert.equal(rejected.length, 0);
		assert.equal(accepted.length, 1);
		const [finding] = accepted;
		assert.equal(finding.page, 2);
		assert.equal(finding.match_type, 'exact');
		assert.equal(pages[1].text.slice(finding.quote_start, finding.quote_end), 'Tab. Glycomet 500 mg twice daily');
		assert.equal(stats.accepted, 1);
	});

	test('corrects the page when the quote is on another page of the same document', () => {
		const { accepted, stats } = verifyFindings([{ ...base, page: 1 }], pages);
		assert.equal(accepted[0].page, 2);
		assert.equal(accepted[0].stated_page, 1);
		assert.equal(accepted[0].page_corrected, true);
		assert.equal(stats.pageCorrections, 1);
	});

	test('rejects an invented quote (quote_not_found)', () => {
		const { accepted, rejected } = verifyFindings([{ ...base, quote: 'Tab. Glycomet 1000 mg twice daily', dose: '1000 mg' }], pages);
		assert.equal(accepted.length, 0);
		assert.equal(rejected[0].reason, 'quote_not_found');
	});

	test('rejects a real sentence paired with a wrong field (field_not_in_quote)', () => {
		const { rejected } = verifyFindings([{ ...base, dose: '1000 mg' }], pages);
		assert.equal(rejected[0].reason, 'field_not_in_quote');
		assert.match(rejected[0].detail, /dose/);
	});

	test('rejects findings without a quote or page (schema_invalid)', () => {
		const { rejected, stats } = verifyFindings([{ ...base, quote: undefined }, { ...base, page: null }, 'nonsense'], pages);
		assert.deepEqual(rejected.map((r) => r.reason), ['schema_invalid', 'schema_invalid', 'schema_invalid']);
		assert.equal(stats.rejectedByReason.schema_invalid, 3);
	});

	test('rejects quotes that are too short or too long (quote_length)', () => {
		const short = { ...base, name: 'Tab', dose: null, frequency: null, quote: 'Tab.' };
		const long = { ...base, quote: `${pages[1].text} `.repeat(10) };
		const { rejected } = verifyFindings([short, long], pages);
		assert.deepEqual(rejected.map((r) => r.reason), ['quote_length', 'quote_length']);
	});

	test('allows the general-statement name for explicit absence', () => {
		const finding = {
			...base,
			category: 'allergy',
			name: 'any drug, general statement',
			assertion: 'absent',
			action: null,
			dose: null,
			frequency: null,
			quote: 'No known drug allergies.',
		};
		const { accepted } = verifyFindings([finding], pages);
		assert.equal(accepted.length, 1);
		assert.equal(accepted[0].action, null);
	});

	test('keeps the raw output of rejected findings and counts by reason', () => {
		const bad = { ...base, quote: 'This sentence is not in the document at all' };
		const { rejected, stats } = verifyFindings([base, bad], pages);
		assert.equal(rejected[0].raw, bad);
		assert.equal(stats.returned, 2);
		assert.equal(stats.accepted, 1);
		assert.equal(stats.rejectedByReason.quote_not_found, 1);
	});

	test('attaches OCR word boxes that overlap the quote', () => {
		const ocrPage = {
			pageNumber: 1,
			text: 'Hb 13.5 g/dL normal',
			source: 'ocr',
			ocrWords: { words: [
				{ text: 'Hb', start: 0, end: 2 }, { text: '13.5', start: 3, end: 7 },
				{ text: 'g/dL', start: 8, end: 12 }, { text: 'normal', start: 13, end: 19 },
			] },
		};
		const finding = { ...base, category: 'investigation', name: 'Hb', action: null, dose: null, frequency: null, value: '13.5', unit: 'g/dL', quote: 'Hb 13.5 g/dL', page: 1 };
		const { accepted } = verifyFindings([finding], [ocrPage]);
		assert.deepEqual(accepted[0].ocr_word_boxes.map((w) => w.text), ['Hb', '13.5', 'g/dL']);
	});
});
