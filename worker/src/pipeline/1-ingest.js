/**
 * Step 1 - Ingest: read the original, confirm its hash, read each page's text
 * layer with pdfjs-dist. Pages with no usable text layer are marked for OCR.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { UnrecoverableError } from 'bullmq';

export const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/tiff', 'image/bmp', 'image/webp']);

/**
 * Rebuild readable page text from pdfjs text items.
 * pdfjs gives positioned fragments; line breaks come from hasEOL or a change in
 * baseline, and a space is inserted where two fragments have a visible gap but
 * neither carries its own whitespace.
 */
export const textFromItems = (items) => {
	let text = '';
	let prev = null;

	for (const item of items) {
		if (typeof item.str !== 'string') continue; // marked-content items carry no text
		const [, , , scaleY, x, y] = item.transform;
		const fontSize = Math.abs(scaleY) || item.height || 10;

		if (prev && item.str) {
			const newLine = !prev.hasEOL && Math.abs(y - prev.y) > fontSize * 0.5;
			const gap = x - (prev.x + prev.width);
			const needsSpace =
				!newLine &&
				!prev.hasEOL &&
				gap > fontSize * 0.15 &&
				!/\s$/u.test(text) &&
				!/^\s/u.test(item.str);
			if (newLine) text += '\n';
			else if (needsSpace) text += ' ';
		}

		text += item.str;
		if (item.hasEOL) text += '\n';
		if (item.str || item.hasEOL) prev = { x, y, width: item.width, hasEOL: item.hasEOL };
	}
	return text.replace(/[ \t]+\n/g, '\n').trimEnd();
};

/** Read the text layer of every page of a PDF buffer. */
export const extractPdfPages = async (buffer, { minTextLayerChars = 20 } = {}) => {
	// pdfjs takes ownership of the array it is given, so pass a copy.
	const pdf = await getDocument({
		data: new Uint8Array(buffer),
		useSystemFonts: false,
		isEvalSupported: false,
		disableFontFace: true,
		verbosity: 0,
	}).promise;

	try {
		const pages = [];
		for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
			const page = await pdf.getPage(pageNumber);
			const content = await page.getTextContent();
			const text = textFromItems(content.items);
			const visibleChars = text.replace(/\s/gu, '').length;
			pages.push({
				pageNumber,
				text,
				source: 'text_layer',
				needsOcr: visibleChars < minTextLayerChars,
				ocrWords: null,
			});
			page.cleanup();
		}
		return pages;
	} finally {
		await pdf.destroy();
	}
};

/**
 * @param {{ filePath: string, mimeType: string, expectedSha256: string, minTextLayerChars?: number }} input
 * @returns {Promise<{ kind: 'pdf' | 'image', buffer: Buffer, fileHash: string, pages: object[] }>}
 */
export const ingest = async ({ filePath, mimeType, expectedSha256, minTextLayerChars }) => {
	let buffer;
	try {
		buffer = await readFile(filePath);
	} catch (error) {
		throw new UnrecoverableError(`Original file is not readable at ${filePath}: ${error.code || error.message}`);
	}

	const fileHash = sha256(buffer);
	if (expectedSha256 && fileHash !== expectedSha256) {
		throw new UnrecoverableError('Stored file hash does not match the hash recorded at upload.');
	}

	const type = (mimeType || '').toLowerCase();
	if (type === 'application/pdf' || buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
		const pages = await extractPdfPages(buffer, { minTextLayerChars });
		if (pages.length === 0) throw new UnrecoverableError('PDF has no pages.');
		return { kind: 'pdf', buffer, fileHash, pages };
	}

	if (IMAGE_TYPES.has(type)) {
		return {
			kind: 'image',
			buffer,
			fileHash,
			pages: [{ pageNumber: 1, text: '', source: 'ocr', needsOcr: true, ocrWords: null }],
		};
	}

	throw new UnrecoverableError(`Unsupported document type: ${mimeType || 'unknown'}`);
};
