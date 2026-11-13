/**
 * Rebuild a PDF page's text from pdf.js text items, and record where each
 * item's text sits in it.
 *
 * MUST stay identical to layoutTextItems() in worker/src/pipeline/1-ingest.js.
 * The worker stores page text built this way, and the Quote Verifier's
 * quote_start / quote_end are offsets into it; the Source Viewer uses the
 * ranges below to map those offsets back onto react-pdf's text-layer spans.
 * worker/tests/pdfTextLayout.parity.test.js checks the two copies agree.
 *
 * @param {Array<{ str?: string, transform: number[], width: number, height: number, hasEOL?: boolean }>} items
 *   page.getTextContent().items (marked-content entries, which have no str, are skipped)
 * @returns {{ text: string, ranges: Array<[number, number] | null> }}
 *   ranges[i] is the [start, end) of items[i].str in text, or null for non-text items
 */
export function layoutTextItems(items) {
	let text = '';
	let prev = null;
	const ranges = items.map(() => null);

	items.forEach((item, index) => {
		if (typeof item.str !== 'string') return;
		const [, , , scaleY, x, y] = item.transform;
		const fontSize = Math.abs(scaleY) || item.height || 10;

		if (prev && item.str) {
			const newLine = !prev.hasEOL && Math.abs(y - prev.y) > fontSize * 0.5;
			const gap = x - (prev.x + prev.width);
			const needsSpace =
				!newLine && !prev.hasEOL && gap > fontSize * 0.15 && !/\s$/u.test(text) && !/^\s/u.test(item.str);
			if (newLine) text += '\n';
			else if (needsSpace) text += ' ';
		}

		const start = text.length;
		text += item.str;
		ranges[index] = [start, text.length];
		if (item.hasEOL) text += '\n';
		if (item.str || item.hasEOL) prev = { x, y, width: item.width, hasEOL: item.hasEOL };
	});

	// Trimming the end never moves an earlier offset.
	const trimmed = text.trimEnd();
	return {
		text: trimmed,
		ranges: ranges.map((range) => (range ? [Math.min(range[0], trimmed.length), Math.min(range[1], trimmed.length)] : null)),
	};
}
