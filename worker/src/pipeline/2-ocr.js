/**
 * Step 2 - OCR: only for scans and images. Uses the Tesseract program installed
 * on the machine (section 8.4) and keeps word bounding boxes, each tied to its
 * character span in the page text, so the source viewer can draw the highlight.
 */
import { spawn } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { UnrecoverableError } from 'bullmq';

const runTesseract = (image, { tesseractPath, language, psm = 6 }) =>
	new Promise((resolvePromise, reject) => {
		// psm 6 reads the page as one block, line by line across the full width, so table rows
		// (test, result, unit, range) stay on one line. Automatic layout (psm 3) often splits
		// tables into columns, which breaks the exact-quote check for every result row.
		const child = spawn(tesseractPath, ['stdin', 'stdout', '-l', language, '--psm', String(psm), 'tsv'], { windowsHide: true });
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

/** Convert canvas pixels to greyscale in place (helps Tesseract on coloured scans and photos). */
const toGreyscale = (context, width, height) => {
	const image = context.getImageData(0, 0, width, height);
	const px = image.data;
	for (let i = 0; i < px.length; i += 4) {
		const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
		px[i] = y;
		px[i + 1] = y;
		px[i + 2] = y;
	}
	context.putImageData(image, 0, 0);
};

/** How much to enlarge an image so its width reaches the OCR target (never shrink, at most 4x). */
const ocrScale = (width, targetWidth) => Math.min(4, Math.max(1, targetWidth / width));

/**
 * Prepare an uploaded image for OCR: enlarge small images and convert to
 * greyscale. Low-resolution phone photos and screenshots lose small text such
 * as units ("mg/dL" read as "mgd") without this.
 * Word boxes are reported in the prepared image's pixels; `scale` maps them back.
 */
const prepareImage = async (buffer, targetWidth) => {
	const image = await loadImage(buffer);
	const scale = ocrScale(image.width, targetWidth);
	const width = Math.round(image.width * scale);
	const height = Math.round(image.height * scale);
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.fillStyle = '#fff'; // transparent PNGs would otherwise turn black
	context.fillRect(0, 0, width, height);
	context.drawImage(image, 0, 0, width, height);
	toGreyscale(context, width, height);
	return { png: canvas.toBuffer('image/png'), width, height, scale, originalWidth: image.width, originalHeight: image.height };
};

/** Render scanned PDF pages at a resolution that gives about targetWidth pixels across. */
const renderPdfPagesToPng = async (buffer, pageNumbers, { renderScale, targetWidth }) => {
	const pdf = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, verbosity: 0 }).promise;
	try {
		const images = new Map();
		for (const pageNumber of pageNumbers) {
			const page = await pdf.getPage(pageNumber);
			const base = page.getViewport({ scale: 1 });
			const scale = Math.max(renderScale, ocrScale(base.width, targetWidth));
			const viewport = page.getViewport({ scale });
			// In Node, pdfjs-dist uses @napi-rs/canvas through its canvas factory.
			const { canvas, context } = pdf.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
			context.fillStyle = '#fff';
			context.fillRect(0, 0, canvas.width, canvas.height);
			await page.render({ canvas, canvasContext: context, viewport }).promise;
			toGreyscale(context, canvas.width, canvas.height);
			images.set(pageNumber, {
				png: canvas.toBuffer('image/png'),
				width: canvas.width,
				height: canvas.height,
				scale, // PDF points -> pixels
				originalWidth: base.width,
				originalHeight: base.height,
			});
			page.cleanup();
		}
		return images;
	} finally {
		await pdf.destroy();
	}
};

/**
 * @param {{ kind: 'pdf' | 'image', buffer: Buffer, pages: object[] }} ingested
 * @param {{ tesseractPath: string, language: string, renderScale: number, targetWidth: number }} ocrConfig
 * @returns {Promise<object[]>} pages, with OCR text filled in where it was needed
 */
export const ocr = async ({ kind, buffer, pages }, ocrConfig) => {
	const targets = pages.filter((page) => page.needsOcr);
	if (targets.length === 0) return pages;

	let images;
	if (kind === 'image') {
		try {
			images = new Map([[1, await prepareImage(buffer, ocrConfig.targetWidth)]]);
		} catch {
			throw new UnrecoverableError('The image could not be read. Upload a PNG or JPEG photo, or a PDF.');
		}
	} else {
		images = await renderPdfPagesToPng(buffer, targets.map((page) => page.pageNumber), ocrConfig);
	}

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
			// Boxes are in the prepared image's pixels; divide by `scale` for the original image (or PDF points).
			ocrWords: {
				imageWidth: image.width,
				imageHeight: image.height,
				scale: image.scale,
				originalWidth: image.originalWidth,
				originalHeight: image.originalHeight,
				words,
			},
		});
	}
	return result;
};
