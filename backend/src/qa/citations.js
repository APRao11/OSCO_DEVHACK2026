/**
 * Citation validation. The model may only cite evidence that was actually
 * supplied, and the quote shown to the user is always text copied from that
 * evidence (never the model's own words):
 *  - unknown evidence ids are dropped;
 *  - if the model's quote appears in the evidence (ignoring case, spacing and
 *    quote/dash style) the exact original wording is used, with its position
 *    in the page text so the Source Viewer can highlight it;
 *  - otherwise the evidence item's own verified quote is used.
 * Document ids, names and page numbers always come from the server's records.
 */

const fold = (s) =>
	s
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[‘’‚‛`´]/g, "'")
		.replace(/[“”„‟]/g, '"')
		.replace(/[‐-―−]/g, '-');

/** Find `needle` in `haystack` ignoring case, whitespace runs and quote/dash style. Returns original offsets or null. */
export const locate = (haystack, needle) => {
	if (!haystack || !needle) return null;
	// Map each kept character of the folded haystack back to its original index.
	const chars = [];
	const map = [];
	let lastSpace = true;
	for (let i = 0; i < haystack.length; i += 1) {
		const c = fold(haystack[i]);
		if (/\s/.test(c)) {
			if (!lastSpace) {
				chars.push(' ');
				map.push(i);
			}
			lastSpace = true;
		} else {
			for (const ch of c) {
				chars.push(ch);
				map.push(i);
			}
			lastSpace = false;
		}
	}
	const folded = chars.join('');
	const target = fold(needle).replace(/\s+/g, ' ').trim().replace(/^["'“]+|["'”.]+$/g, '');
	if (target.length < 4) return null;
	const at = folded.indexOf(target);
	if (at === -1) return null;
	return { start: map[at], end: map[at + target.length - 1] + 1 };
};

/**
 * @param {{ evidence: string, quote: string }[]} cited   from the model
 * @param {object[]} evidence                              what retrieval supplied
 * @param {(documentId: string) => object | undefined} documentOf
 * @returns {object[]} validated citations (at most 6, one per evidence item)
 */
export const validateCitations = (cited, evidence, documentOf) => {
	const byId = new Map(evidence.map((e) => [e.id, e]));
	const seen = new Set();
	const out = [];
	for (const c of cited) {
		const e = byId.get(c.evidence);
		if (!e || seen.has(e.id)) continue;
		seen.add(e.id);
		const doc = documentOf(e.documentId);
		if (!doc) continue;

		// Prefer the model's phrase when it really is in the evidence; fall back to the evidence's own quote.
		let quote = e.quote ?? e.text;
		let quoteStart = e.quoteStart;
		let quoteEnd = e.quoteEnd;
		let matched = false;
		const page = e.page ? doc.pages?.find((p) => p.pageNumber === e.page) : null;
		if (c.quote && page && e.quoteStart != null) {
			const region = page.text.slice(e.quoteStart, e.quoteEnd);
			const hit = locate(region, c.quote);
			if (hit) {
				quoteStart = e.quoteStart + hit.start;
				quoteEnd = e.quoteStart + hit.end;
				quote = page.text.slice(quoteStart, quoteEnd);
				matched = true;
			}
		}

		out.push({
			id: e.id,
			kind: e.kind,
			documentId: doc.id,
			documentName: doc.name,
			documentType: doc.documentType,
			documentDate: doc.documentDate ?? null,
			page: e.page,
			quote,
			quoteMatchedModel: matched,
			findingId: e.findingId,
			// What the Source Viewer needs to open the page with the quote highlighted (documents only).
			source:
				page && quoteStart != null
					? {
							document: { ...doc, pages: [page] },
							page: e.page,
							quoteStart,
							quoteEnd,
							quote,
						}
					: null,
		});
		if (out.length >= 6) break;
	}
	return out;
};
