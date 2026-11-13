/**
 * Step 2 - OCR: only for scans and images. Uses the Tesseract program installed
 * on the machine (section 8.4) and keeps word bounding boxes, each tied to its
 * character span in the page text, so the source viewer can draw the highlight.
 */
import { spawn } from 'node:child_process';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { UnrecoverableError } from 'bullmq';

const runTesseract = (image, { tesseractPath, language }) =>
	new Promise((resolvePromise, reject) => {
		const child = spawn(tesseractPath, ['stdin', 'stdout', '-l', language, 'tsv'], { windowsHide: true });
		const out = [];
		const err = [];
		child.stdout.on('data', (chunk) => out.push(chunk));
		child.stderr.on('data', (chunk) => err.push(chunk));
		child.on('error', (error) => {
			if (error.code === 'ENOENT') {
				reject(new UnrecoverableError(`Tesseract is not installed or not on PATH ("${tesseractPath}"). Set TESSERACT_PATH.`));
			} else reject(error);
		});
		child.on('close', (code) => {
			if (code === 0) resolvePromise(Buffer.concat(out).toString('utf8'));
			else reject(new Error(`Tesseract exited with code ${code}: ${Buffer.concat(err).toString('utf8').trim()}`));
		});
		child.stdin.on('error', () => {}); // surfaced through 'close'
		child.stdin.end(image);
	});

/**
 * Turn Tesseract TSV into page text plus word boxes.
 * Words on a line are joined by a space, lines and paragraphs by a newline.
 * Each word keeps { text, start, end, left, top, width, height, conf }, where
 * [start, end) indexes the returned text.
 */
export const parseTesseractTsv = (tsv) => {
	const words = [];
	let text = '';
	let lastLineKey = null;

	for (const row of tsv.split(/\r?\n/).slice(1)) {
		const cols = row.split('\t');
		if (cols.length < 12 || cols[0] !== '5') continue; // level 5 = word
		const wordText = cols.slice(11).join('\t').trim();
		if (!wordText) continue;

		const lineKey = `${cols[1]}:${cols[2]}:${cols[3]}:${cols[4]}`;
		if (lastLineKey !== null) text += lineKey === lastLineKey ? ' ' : '\n';
		lastLineKey = lineKey;

		const start = text.length;
		text += wordText;
		words.push({
			text: wordText,
			start,
			end: text.length,
			left: Number(cols[6]),
			top: Number(cols[7]),
			width: Number(cols[8]),
			height: Number(cols[9]),
			conf: Number(cols[10]),
		});
	}
	return { text, words };
};

const renderPdfPagesToPng = async (buffer, pageNumbers, scale) => {
	const pdf = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 }).promise;
	try {
		const images = new Map();
		for (const pageNumber of pageNumbers) {
			const page = await pdf.getPage(pageNumber);
			const viewport = page.getViewport({ scale });
			// In Node, pdfjs-dist uses @napi-rs/canvas through its canvas factory.
			const { canvas, context } = pdf.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
			await page.render({ canvas, canvasContext: context, viewport }).promise;
			images.set(pageNumber, { png: canvas.toBuffer('image/png'), width: canvas.width, height: canvas.height });
			page.cleanup();
		}
		return images;
	} finally {
		await pdf.destroy();
	}
};

/**
 * @param {{ kind: 'pdf' | 'image', buffer: Buffer, pages: object[] }} ingested
 * @param {{ tesseractPath: string, language: string, renderScale: number }} ocrConfig
 * @returns {Promise<object[]>} pages, with OCR text filled in where it was needed
 */
export const ocr = async ({ kind, buffer, pages }, ocrConfig) => {
	const targets = pages.filter((page) => page.needsOcr);
	if (targets.length === 0) return pages;

	const images =
		kind === 'image'
			? new Map([[1, { png: buffer, width: null, height: null }]])
			: await renderPdfPagesToPng(buffer, targets.map((page) => page.pageNumber), ocrConfig.renderScale);

	const result = [];
	for (const page of pages) {
		if (!page.needsOcr) {
			result.push(page);
			continue;
		}
		const image = images.get(page.pageNumber);
		const { text, words } = parseTesseractTsv(await runTesseract(image.png, ocrConfig));
		result.push({
			...page,
			text,
			source: 'ocr',
			ocrWords: { imageWidth: image.width, imageHeight: image.height, words },
		});
	}
	return result;
};
