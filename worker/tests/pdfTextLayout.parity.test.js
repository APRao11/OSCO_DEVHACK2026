/**
 * The worker builds page text (and so quote_start / quote_end) with
 * layoutTextItems; the frontend Source Viewer rebuilds the same text from
 * react-pdf's items to place the highlight. If the two copies drift, highlights
 * land in the wrong place, so this test runs both over real PDFs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { layoutTextItems as workerLayout } from '../src/pipeline/1-ingest.js';
import { layoutTextItems as frontendLayout } from '../../frontend/src/utils/pdfTextLayout.js';

const SAMPLE_DIRS = ['../frontend/public/demo', '../ai-processing/samples'];

const samplePdfs = async () => {
	const files = [];
	for (const dir of SAMPLE_DIRS) {
		if (!existsSync(dir)) continue;
		for (const name of await readdir(dir)) if (name.endsWith('.pdf')) files.push(`${dir}/${name}`);
	}
	return files;
};

test('worker and frontend lay out PDF text identically', async () => {
	const files = await samplePdfs();
	assert.ok(files.length > 0, 'no sample PDFs found');

	for (const file of files) {
		const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 }).promise;
		for (let n = 1; n <= pdf.numPages; n += 1) {
			const { items } = await (await pdf.getPage(n)).getTextContent();
			const worker = workerLayout(items);
			assert.deepEqual(frontendLayout(items), worker, `${file} page ${n}`);
			// Every range must point at exactly that item's text.
			worker.ranges.forEach((range, i) => {
				if (range && range[1] <= worker.text.length && items[i].str.trimEnd() === items[i].str) {
					assert.equal(worker.text.slice(range[0], range[1]), items[i].str, `${file} p${n} item ${i}`);
				}
			});
		}
		await pdf.destroy();
	}
});
