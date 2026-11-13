/**
 * Retrieval for the chatbot ("structured-first RAG", MVP document 8.1).
 *
 * Evidence comes only from the one patient's records as built by
 * records.service.js: confirmed, current findings first (each with its verified
 * quote and page), then passages of the stored page text and doctor-visit
 * observations. Ranking is simple keyword overlap plus a boost for the kind of
 * record the question asks about. No embeddings or vector store.
 */

const STOPWORDS = new Set(
	'the a an and or of to in on at for with by from my me i is are was were be been what when which who whom whose how did does do have has had any all about this that these those there their your you it its as can could would should will tell show list give please record records document documents'.split(' '),
);

/** Words in a question that point at a kind of record. */
const INTENTS = [
	{ category: 'medication', pattern: /\b(medic\w*|medicine|drug|tablet|pill|prescri\w*|dose|dosage|taking|took|tab|capsule|insulin)\b/i },
	{ category: 'allergy', pattern: /\b(allerg\w*|react\w*|intoleran\w*)\b/i },
	{ category: 'investigation', pattern: /\b(test|lab|labs|result|results|blood|report|level|levels|scan|x-?ray|hba1c|glucose|sugar|cholesterol|creatinine|value|values)\b/i },
	{ category: 'condition', pattern: /\b(diagnos\w*|condition|conditions|disease|illness|problem|problems|history)\b/i },
	{ category: 'event', pattern: /\b(admi\w*|hospital\w*|surgery|operation|procedure|visit|discharg\w*|event|events)\b/i },
];

const GENERAL = /\b(summar\w*|overview|everything|all my|history|what('?s| is) in)\b/i;

export const tokenize = (text) =>
	(text ?? '')
		.toLowerCase()
		.normalize('NFKC')
		.split(/[^a-z0-9.]+/)
		.map((w) => w.replace(/^\.+|\.+$/g, ''))
		.filter((w) => w.length >= 3 && !STOPWORDS.has(w));

const CATEGORY_LABEL = { condition: 'Condition', medication: 'Medicine', allergy: 'Allergy', investigation: 'Test result', event: 'Event' };
const ASSERTION_LABEL = { absent: 'documented as absent', possible: 'possible, unconfirmed', historical: 'past history' };

const findingSummary = (f) => {
	const parts = [`${CATEGORY_LABEL[f.category] ?? 'Finding'}: ${f.name}`];
	if (f.category === 'medication') parts.push([f.action && f.action !== 'none' ? f.action : null, f.dose, f.frequency].filter(Boolean).join(' '));
	else if (f.value || f.unit) parts.push([f.value, f.unit].filter(Boolean).join(' ') + (f.refRange ? ` (lab range ${f.refRange})` : ''));
	if (ASSERTION_LABEL[f.assertion]) parts.push(ASSERTION_LABEL[f.assertion]);
	if (f.subject && f.subject !== 'patient') parts.push(`about ${f.subjectRelation ?? 'a relative'}, not the patient`);
	return parts.filter(Boolean).join(' · ');
};

const score = (text, terms) => {
	if (!terms.length) return 0;
	const tokens = tokenize(text);
	let s = 0;
	for (const term of terms) {
		const hits = tokens.filter((t) => t === term || (term.length >= 5 && t.startsWith(term.slice(0, 5)))).length;
		s += Math.min(hits, 3);
	}
	return s;
};

/** Split page text into passages of a few lines, keeping their offsets in the page text. */
const passages = (text, linesPer = 3, step = 2) => {
	const lines = [];
	let offset = 0;
	for (const line of text.split('\n')) {
		if (line.trim()) lines.push({ text: line, start: offset, end: offset + line.length });
		offset += line.length + 1;
	}
	const out = [];
	for (let i = 0; i < lines.length; i += step) {
		const window = lines.slice(i, i + linesPer);
		if (!window.length) break;
		const start = window[0].start;
		const end = window[window.length - 1].end;
		out.push({ start, end, text: text.slice(start, end) });
		if (i + linesPer >= lines.length) break;
	}
	return out;
};

/**
 * @param {object} records  buildPatientRecords() output for ONE patient
 * @param {string} question
 * @returns {{ evidence: object[], intents: string[], documentsChecked: number, findingsChecked: number }}
 *   evidence: [{ id: 'E1', kind: 'finding' | 'page' | 'note', text, label, documentId, page, quote, quoteStart, quoteEnd, findingId, date }]
 */
export const retrieveEvidence = (records, question, { maxFindings = 12, maxPassages = 5, maxChars = 9000 } = {}) => {
	const terms = [...new Set(tokenize(question))];
	const intents = INTENTS.filter((i) => i.pattern.test(question)).map((i) => i.category);
	const general = GENERAL.test(question);
	const docs = new Map(records.documents.map((d) => [d.id, d]));
	const dateOf = (doc, f) => f?.eventDate ?? doc?.documentDate ?? null;

	const findingCandidates = records.findings.map((f) => {
		const doc = docs.get(f.documentId);
		const text = `${findingSummary(f)}${f.quote ? ` — “${f.quote}”` : ''}`;
		let s = score(`${text} ${f.nameNormalised ?? ''}`, terms);
		if (intents.includes(f.category)) s += 3;
		if (general) s += 1;
		return { f, doc, text, s, date: dateOf(doc, f) ?? '' };
	});
	const findings = findingCandidates
		.filter((c) => c.s > 0)
		.sort((a, b) => b.s - a.s || b.date.localeCompare(a.date))
		.slice(0, maxFindings);

	const passageCandidates = [];
	for (const doc of records.documents) {
		if (doc.status !== 'ready') continue;
		if (doc.kind === 'clinical_record') {
			const notes = doc.clinicalRecord?.observations;
			if (notes) {
				const s = score(notes, terms) + (general ? 1 : 0);
				if (s > 0) passageCandidates.push({ kind: 'note', doc, text: notes, page: null, start: null, end: null, s, date: doc.documentDate ?? '' });
			}
			continue;
		}
		for (const page of doc.pages ?? []) {
			for (const p of passages(page.text ?? '')) {
				const s = score(p.text, terms);
				if (s >= Math.min(2, terms.length)) passageCandidates.push({ kind: 'page', doc, text: p.text, page: page.pageNumber, start: p.start, end: p.end, s, date: doc.documentDate ?? '' });
			}
		}
	}
	const chosenPassages = passageCandidates.sort((a, b) => b.s - a.s || b.date.localeCompare(a.date)).slice(0, maxPassages);

	const evidence = [];
	let chars = 0;
	const push = (item) => {
		if (chars + item.text.length > maxChars) return;
		chars += item.text.length;
		evidence.push({ ...item, id: `E${evidence.length + 1}` });
	};
	for (const c of findings) {
		push({
			kind: 'finding',
			text: c.text,
			label: `${c.doc?.name ?? 'Record'}${c.f.page ? `, page ${c.f.page}` : ''}`,
			documentId: c.f.documentId,
			page: c.f.page ?? null,
			quote: c.f.quote ?? null,
			quoteStart: c.f.quoteStart ?? null,
			quoteEnd: c.f.quoteEnd ?? null,
			findingId: c.f.id,
			date: c.date || null,
			source: c.f.sourceType,
		});
	}
	for (const p of chosenPassages) {
		push({
			kind: p.kind,
			text: p.text,
			label: p.kind === 'note' ? `${p.doc.name} (observations)` : `${p.doc.name}, page ${p.page}`,
			documentId: p.doc.id,
			page: p.page,
			quote: p.text,
			quoteStart: p.start,
			quoteEnd: p.end,
			findingId: null,
			date: p.date || null,
			source: p.kind === 'note' ? 'doctor_entered' : 'document_text',
		});
	}

	return {
		evidence,
		intents,
		documentsChecked: records.documents.filter((d) => d.status === 'ready').length,
		findingsChecked: records.findings.length,
	};
};
