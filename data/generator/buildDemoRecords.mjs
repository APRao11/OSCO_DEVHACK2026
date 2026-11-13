/**
 * Builds the synthetic demo patient used by the frontend for the demo path
 * (MVP document section 15.1). SYNTHETIC DATA ONLY.
 *
 *   node data/generator/buildDemoRecords.mjs        (from the repo root)
 *
 * 1. Writes six small text PDFs to frontend/public/demo/.
 * 2. Runs the REAL worker steps over them: pdf.js text extraction (step 1),
 *    the Quote Verifier (step 5), normalisation (step 6) and medication
 *    reconciliation (step 8). The "LLM output" below is hand-written, including
 *    one invented finding and one wrong value, so the verifier has something to reject.
 * 3. Writes frontend/src/mock/demoRecords.json.
 *
 * Because quote_start / quote_end come from the real verifier over the real
 * page text, the Source Viewer highlights exactly what the pipeline would.
 * The contradiction / missing-field / ambiguous-date flags are computed here
 * with simple rules, because worker/src/reconcile/{contradictions,gaps}.js are
 * not implemented yet.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdfPages, sha256 } from '../../worker/src/pipeline/1-ingest.js';
import { verifyFindings } from '../../worker/src/pipeline/5-verify.js';
import { normalise, parseDate } from '../../worker/src/pipeline/6-normalise.js';
import { reconcileMedications } from '../../worker/src/reconcile/medicationEpisodes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PDF_DIR = resolve(root, 'frontend/public/demo');
const FIXTURE = resolve(root, 'frontend/src/mock/demoRecords.json');

// Fixed so the fixture (and the brief built from it) is reproducible.
const BUILT_AT = '2026-11-13';
const EXTRACTOR_VERSION = 'demo-v1';

// ------------------------------------------------------------- tiny PDF writer

const escapePdf = (text) => text.replace(/[\\()]/g, (c) => `\\${c}`);

/** One A4 page per entry in `pages`; each line is a string or { text, bold, size }. */
const writePdf = (pages) => {
	const objects = [];
	const add = (body) => {
		objects.push(body);
		return objects.length;
	};
	const catalog = add(null);
	const pagesObj = add(null);
	const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
	const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

	const pageIds = pages.map((lines) => {
		let y = 780;
		const ops = lines.map((line) => {
			const { text, bold: isBold = false, size = 11 } = typeof line === 'string' ? { text: line } : line;
			y -= size >= 14 ? 26 : 19;
			return `BT /${isBold ? 'F2' : 'F1'} ${size} Tf 56 ${y} Td (${escapePdf(text)}) Tj ET`;
		});
		const stream = ops.join('\n');
		const contents = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
		return add(
			`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] ` +
				`/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R >>`,
		);
	});
	objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
	objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

	let pdf = '%PDF-1.4\n';
	const offsets = objects.map((body, i) => {
		const offset = Buffer.byteLength(pdf, 'latin1');
		pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
		return offset;
	});
	const xref = Buffer.byteLength(pdf, 'latin1');
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(pdf, 'latin1');
};

// --------------------------------------------------------------- demo content

const FOOTER = 'Synthetic data - for software testing only.';
const title = (text) => ({ text, bold: true, size: 16 });
const heading = (text) => ({ text, bold: true });

const f = (category, name, quote, page, extra = {}) => ({
	category, name, quote, page,
	subject: 'patient', subject_relation: null, assertion: 'present', action: null,
	dose: null, frequency: null, value: null, unit: null, ref_range: null, date_text: null,
	...extra,
});
const med = (name, action, quote, page, extra = {}) => f('medication', name, quote, page, { action, ...extra });
const lab = (name, value, unit, range, quote) => f('investigation', name, quote, 1, { value, unit, ref_range: range });

const DOCUMENTS = [
	{
		id: 'doc-consult-2018',
		file: 'consultation-2018-03-12.pdf',
		name: 'Consultation note - City Diabetes Clinic',
		documentType: 'clinical_note',
		dateText: '12 Mar 2018',
		pages: [[
			title('City Diabetes Clinic'), heading('Consultation Note'), 'Date: 12 Mar 2018',
			'Patient: Elena Vance (synthetic)',
			'Presenting complaint: increased thirst and tiredness for 3 months.',
			'Past history: Appendectomy in 2015.',
			'Family history: Mother had type 2 diabetes.',
			'Assessment: Type 2 diabetes mellitus, newly diagnosed.',
			'Plan: Diet advice. Repeat HbA1c in 3 months.',
			'Dr R. Iyer', FOOTER,
		]],
		llmFindings: [
			f('condition', 'Type 2 diabetes mellitus', 'Assessment: Type 2 diabetes mellitus, newly diagnosed.', 1),
			f('event', 'Appendectomy', 'Past history: Appendectomy in 2015.', 1, { assertion: 'historical', date_text: '2015' }),
			f('condition', 'type 2 diabetes', 'Family history: Mother had type 2 diabetes.', 1, { subject: 'family', subject_relation: 'Mother' }),
		],
	},
	{
		id: 'doc-rx-2019',
		file: 'prescription-2019-03-12.pdf',
		name: 'Prescription - Sunrise Medical Centre (2019)',
		documentType: 'prescription',
		dateText: '12 Mar 2019',
		pages: [[
			title('Sunrise Medical Centre'), heading('Prescription'), 'Date: 12 Mar 2019',
			'Allergies: Penicillin - rash',
			heading('Rx'),
			'1. Tab. Glycomet 500 mg twice daily - start',
			'2. Tab. Atorvastatin 10 mg once daily at night - start',
			'Review after 3 months.', 'Dr S. Rao', FOOTER,
		]],
		llmFindings: [
			f('allergy', 'Penicillin', 'Allergies: Penicillin - rash', 1),
			med('Glycomet', 'start', 'Tab. Glycomet 500 mg twice daily - start', 1, { dose: '500 mg', frequency: 'twice daily' }),
			med('Atorvastatin', 'start', 'Tab. Atorvastatin 10 mg once daily at night - start', 1, { dose: '10 mg', frequency: 'once daily at night' }),
		],
	},
	{
		id: 'doc-rx-2021',
		file: 'prescription-2021-02-02.pdf',
		name: 'Prescription - Sunrise Medical Centre (2021)',
		documentType: 'prescription',
		dateText: '02 Feb 2021',
		pages: [[
			title('Sunrise Medical Centre'), heading('Prescription'), 'Date: 02 Feb 2021',
			heading('Rx'),
			'1. Tab. Glycomet - dose changed to 1000 mg once daily',
			'2. Tab. Pantoprazole once daily before breakfast - start',
			'3. Continue Tab. Atorvastatin 10 mg once daily at night',
			'Dr S. Rao', FOOTER,
		]],
		llmFindings: [
			med('Glycomet', 'change', 'Tab. Glycomet - dose changed to 1000 mg once daily', 1, { dose: '1000 mg', frequency: 'once daily' }),
			med('Pantoprazole', 'start', 'Tab. Pantoprazole once daily before breakfast - start', 1, { frequency: 'once daily before breakfast' }),
			med('Atorvastatin', 'continue', 'Continue Tab. Atorvastatin 10 mg once daily at night', 1, { dose: '10 mg', frequency: 'once daily at night' }),
		],
	},
	{
		id: 'doc-lab-2021',
		file: 'lab-report-2021.pdf',
		name: 'Laboratory report - Metro Diagnostics (date unclear)',
		documentType: 'lab_report',
		dateText: '04/05/2021', // ambiguous on purpose: 4 May or 5 April
		pages: [[
			title('Metro Diagnostics Laboratory'), heading('Laboratory Report'), 'Sample date: 04/05/2021',
			'Test / Result / Unit / Reference range',
			'HbA1c 7.8 % (4.0 - 5.6)',
			'Fasting plasma glucose 142 mg/dL (70 - 99)',
			FOOTER,
		]],
		llmFindings: [
			lab('HbA1c', '7.8', '%', '4.0 - 5.6', 'HbA1c 7.8 % (4.0 - 5.6)'),
			lab('Fasting plasma glucose', '142', 'mg/dL', '70 - 99', 'Fasting plasma glucose 142 mg/dL (70 - 99)'),
		],
	},
	{
		id: 'doc-lab-2024',
		file: 'lab-report-2024-06-10.pdf',
		name: 'Laboratory report - Metro Diagnostics (2024)',
		documentType: 'lab_report',
		dateText: '10 Jun 2024',
		pages: [[
			title('Metro Diagnostics Laboratory'), heading('Laboratory Report'), 'Report date: 10 Jun 2024',
			'Test / Result / Unit / Reference range',
			'HbA1c 7.1 % (4.0 - 5.6)',
			'Fasting plasma glucose 131 mg/dL (70 - 99)',
			'Serum creatinine 0.9 mg/dL (0.6 - 1.1)',
			FOOTER,
		]],
		llmFindings: [
			lab('HbA1c', '7.1', '%', '4.0 - 5.6', 'HbA1c 7.1 % (4.0 - 5.6)'),
			lab('Fasting plasma glucose', '131', 'mg/dL', '70 - 99', 'Fasting plasma glucose 131 mg/dL (70 - 99)'),
			lab('Serum creatinine', '0.9', 'mg/dL', '0.6 - 1.1', 'Serum creatinine 0.9 mg/dL (0.6 - 1.1)'),
			// Wrong value paired with a real sentence: rejected as field_not_in_quote.
			lab('HbA1c', '6.8', '%', '4.0 - 5.6', 'HbA1c 7.1 % (4.0 - 5.6)'),
		],
	},
	{
		id: 'doc-discharge-2024',
		file: 'discharge-summary-2024-06-14.pdf',
		name: "Discharge summary - St. Mary's Hospital",
		documentType: 'discharge_summary',
		dateText: '14 Jun 2024',
		pages: [
			[
				title("St. Mary's Hospital"), heading('Discharge Summary'),
				'Date of admission: 10 Jun 2024', 'Date of discharge: 14 Jun 2024',
				'Diagnosis: Community-acquired pneumonia, right lower lobe.',
				'Chest X-ray: right lower lobe consolidation.',
				'Query asthma - for review in clinic.',
				'Known case of type 2 diabetes mellitus - on treatment.',
				'Allergies: No known drug allergies.',
				'Continued on page 2.',
			],
			[
				heading('Medications on discharge'),
				'1. Tab. Metformin 1000 mg once daily - continue',
				'2. Tab. Azithromycin 500 mg once daily for 3 days - start',
				'3. Tab. Atorvastatin 10 mg - stopped (muscle pain)',
				'Follow-up: diabetes clinic in 2 weeks.',
				'Dr K. Thomas', FOOTER,
			],
		],
		llmFindings: [
			f('event', 'admission', 'Date of admission: 10 Jun 2024', 1, { date_text: '10 Jun 2024' }),
			f('condition', 'Community-acquired pneumonia', 'Diagnosis: Community-acquired pneumonia, right lower lobe.', 1),
			f('investigation', 'Chest X-ray', 'Chest X-ray: right lower lobe consolidation.', 1, { value: 'right lower lobe consolidation' }),
			f('condition', 'asthma', 'Query asthma - for review in clinic.', 1, { assertion: 'possible' }),
			f('condition', 'type 2 diabetes mellitus', 'Known case of type 2 diabetes mellitus - on treatment.', 1),
			f('allergy', 'any drug, general statement', 'Allergies: No known drug allergies.', 1, { assertion: 'absent' }),
			// Model gave page 1; the quote is on page 2, so the verifier corrects the page.
			med('Metformin', 'continue', 'Tab. Metformin 1000 mg once daily - continue', 1, { dose: '1000 mg', frequency: 'once daily' }),
			med('Azithromycin', 'start', 'Tab. Azithromycin 500 mg once daily for 3 days - start', 2, { dose: '500 mg', frequency: 'once daily for 3 days' }),
			med('Atorvastatin', 'stop', 'Tab. Atorvastatin 10 mg - stopped (muscle pain)', 2, { dose: '10 mg' }),
			// Invented by the "model": not in the document, rejected as quote_not_found.
			med('Warfarin', 'continue', 'Tab. Warfarin 5 mg once daily - continue', 2, { dose: '5 mg', frequency: 'once daily' }),
		],
	},
];

// ------------------------------------------------------------------- pipeline

const toCamel = (claim) => ({
	id: claim.id,
	documentId: claim.document_id,
	category: claim.category,
	name: claim.name,
	nameNormalised: claim.name_normalised,
	subject: claim.subject,
	subjectRelation: claim.subject_relation,
	assertion: claim.assertion,
	action: claim.action,
	dose: claim.dose,
	frequency: claim.frequency,
	value: claim.value,
	unit: claim.unit,
	refRange: claim.ref_range,
	dateText: claim.date_text,
	eventDate: claim.event_date,
	datePrecision: claim.date_precision,
	dateAlternatives: claim.normalised?.date_alternatives ?? null,
	quote: claim.quote,
	page: claim.page,
	quoteStart: claim.quote_start,
	quoteEnd: claim.quote_end,
	matchType: claim.match_type,
	sourceType: 'ai_extracted',
	verificationStatus: 'unverified',
});

const main = async () => {
	await mkdir(PDF_DIR, { recursive: true });

	const documents = [];
	const claims = [];
	const totals = { returned: 0, accepted: 0, rejected: 0, rejectedByReason: {}, pageCorrections: 0 };

	for (const spec of DOCUMENTS) {
		const buffer = writePdf(spec.pages);
		await writeFile(resolve(PDF_DIR, spec.file), buffer);

		const pages = await extractPdfPages(buffer); // step 1, the worker's own code
		const { accepted, stats } = verifyFindings(spec.llmFindings, pages); // step 5
		const normalised = normalise(accepted); // step 6

		const date = parseDate(spec.dateText);
		documents.push({
			id: spec.id,
			name: spec.name,
			fileUrl: `/demo/${spec.file}`,
			fileHash: sha256(buffer),
			documentType: spec.documentType,
			documentDate: date.ambiguous ? null : date.event_date,
			documentDateText: spec.dateText,
			dateAlternatives: date.date_alternatives,
			status: 'ready',
			pageCount: pages.length,
			pages: pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text })),
		});

		normalised.forEach((finding, i) => {
			claims.push({ ...finding, id: `${spec.id}-f${i + 1}`, document_id: spec.id, document_date: date.ambiguous ? null : date.event_date });
		});

		totals.returned += stats.returned;
		totals.accepted += stats.accepted;
		totals.rejected += stats.rejected;
		totals.pageCorrections += stats.pageCorrections;
		for (const [reason, n] of Object.entries(stats.rejectedByReason)) {
			totals.rejectedByReason[reason] = (totals.rejectedByReason[reason] ?? 0) + n;
		}
	}

	// Step 8: medication histories (real reconciliation code).
	const { histories } = reconcileMedications(claims, { asOf: BUILT_AT });

	// Simple flag rules for the demo (contradictions.js / gaps.js are not implemented yet).
	const flags = [];
	const docDate = (id) => documents.find((d) => d.id === id)?.documentDate ?? '';
	const allergies = claims.filter((c) => c.category === 'allergy' && c.subject === 'patient');
	for (const present of allergies.filter((c) => c.assertion === 'present')) {
		for (const absent of allergies.filter((c) => c.assertion === 'absent')) {
			if (docDate(absent.document_id) > docDate(present.document_id)) {
				flags.push({
					type: 'contradiction',
					message: `An allergy to ${present.name} is recorded, but a later document says there are no known drug allergies. Records disagree, needs review.`,
					findingIds: [present.id, absent.id],
				});
			}
		}
	}
	for (const c of claims.filter((x) => x.category === 'medication' && x.subject === 'patient' && !x.dose)) {
		flags.push({ type: 'missing_field', message: `${c.name} is prescribed without a dose. Information missing.`, findingIds: [c.id] });
	}
	for (const c of claims.filter((x) => x.category === 'investigation' && x.value && /^\d/.test(x.value) && !x.unit)) {
		flags.push({ type: 'missing_field', message: `${c.name} result has no unit. Information missing.`, findingIds: [c.id] });
	}
	for (const d of documents.filter((x) => x.dateAlternatives)) {
		flags.push({
			type: 'ambiguous_date',
			message: `The date "${d.documentDateText}" on "${d.name}" could be ${d.dateAlternatives.join(' or ')}. Information missing.`,
			findingIds: claims.filter((c) => c.document_id === d.id).map((c) => c.id),
			documentIds: [d.id],
		});
	}
	for (const history of histories) {
		for (const flag of history.flags) {
			flags.push({ type: flag.type, message: flag.message, findingIds: flag.claimIds.filter(Boolean) });
		}
	}

	const fixture = {
		_comment: 'Generated by data/generator/buildDemoRecords.mjs - synthetic data only. Do not edit by hand.',
		patientId: 'OSCO-7F3K9QXM',
		patientName: 'Elena Vance (synthetic)',
		builtAt: BUILT_AT,
		extractorVersion: EXTRACTOR_VERSION,
		extractionStats: totals,
		documents,
		findings: claims.map(toCamel),
		medicationHistories: histories,
		flags: flags.map((flag, i) => ({ id: `flag-${i + 1}`, status: 'open', documentIds: [], ...flag })),
	};

	await writeFile(FIXTURE, `${JSON.stringify(fixture, null, 2)}\n`);
	console.log(
		`Wrote ${documents.length} PDFs and ${FIXTURE}: ${totals.returned} findings extracted, ` +
			`${totals.accepted} accepted, ${totals.rejected} rejected ${JSON.stringify(totals.rejectedByReason)}, ` +
			`${totals.pageCorrections} page correction(s), ${histories.length} medication histories, ${flags.length} flags.`,
	);
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
