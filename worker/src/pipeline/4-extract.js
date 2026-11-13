/**
 * Step 4 - Extract: the LLM returns findings as JSON, each with a verbatim quote
 * and a page. Results are cached by file hash + extractor_version (section 8.3)
 * so re-runs, demos and evaluation are repeatable even if the API is down.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { completeJson } from '../llm/client.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../llm/prompts/extraction.prompt.js';

/** Group pages into chunks of at most maxChars, never splitting a page. */
export const chunkPages = (pages, maxChars) => {
	const chunks = [];
	let current = [];
	let size = 0;
	for (const page of pages) {
		if (current.length && size + page.text.length > maxChars) {
			chunks.push(current);
			current = [];
			size = 0;
		}
		current.push(page);
		size += page.text.length;
	}
	if (current.length) chunks.push(current);
	return chunks;
};

const parseJson = (raw) => {
	const trimmed = String(raw ?? '').trim().replace(/^```(?:json)?s*/i, '').replace(/s*```$/, '');
	try {
		return JSON.parse(trimmed);
	} catch {
		throw new Error('LLM did not return valid JSON.');
	}
};

/** The model's document_date claim ({ date_text, quote, page }), or null. Verified later like any quote. */
export const parseDocumentDate = (raw) => {
	const parsed = parseJson(raw);
	const claim = Array.isArray(parsed) ? null : parsed?.document_date;
	return claim && typeof claim === 'object' && !Array.isArray(claim) ? claim : null;
};

/** Parse the model's JSON, tolerating a ```json fence around it. */
export const parseModelOutput = (raw) => {
	const trimmed = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	let parsed;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new Error('LLM did not return valid JSON.');
	}
	const findings = Array.isArray(parsed) ? parsed : parsed?.findings;
	if (!Array.isArray(findings)) throw new Error('LLM JSON has no "findings" array.');
	return findings;
};

/**
 * Cache key: file hash + extractor version + hash of the page text sent to the model.
 * The model's answer depends on that text, so an OCR change never reuses a stale answer.
 */
const textHash = (pages) =>
	createHash('sha256').update(JSON.stringify(pages.map((p) => [p.pageNumber, p.text]))).digest('hex').slice(0, 16);

const cachePath = (cacheDir, fileHash, extractorVersion, pagesHash) =>
	join(cacheDir, `${fileHash}_${extractorVersion.replace(/[^\w.-]/g, '_')}_${pagesHash}.json`);

const readCache = async (path) => {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch {
		return null;
	}
};

/**
 * @returns {Promise<{ findings: object[], documentDate: object | null, rawOutputs: string[], fromCache: boolean, model: string }>}
 *   findings and documentDate are exactly as the model returned them (both are verified in step 5).
 */
export const extract = async ({ fileHash, extractorVersion, documentType, pages }, { llm, cacheDir }) => {
	const pagesHash = textHash(pages);
	const path = cachePath(cacheDir, fileHash, extractorVersion, pagesHash);
	const cached = await readCache(path);

	let rawOutputs;
	let model;
	let fromCache = false;
	if (cached?.fileHash === fileHash && cached?.extractorVersion === extractorVersion && cached?.pagesHash === pagesHash && Array.isArray(cached.rawOutputs)) {
		rawOutputs = cached.rawOutputs;
		model = cached.model;
		fromCache = true;
	} else {
		const withText = pages.filter((page) => page.text.trim());
		rawOutputs = [];
		const usedModels = new Set();
		for (const chunk of chunkPages(withText, llm.maxCharsPerCall)) {
			const { text: raw, model: usedModel } = await completeJson(llm, { system: SYSTEM_PROMPT, user: buildUserPrompt({ documentType, pages: chunk }) });
			parseModelOutput(raw); // validate before caching; throws -> job retries
			rawOutputs.push(raw);
			usedModels.add(usedModel);
		}
		// Record the model(s) that actually answered, which may be a fallback.
		model = `${llm.provider}:${[...usedModels].join('+') || llm.model}`;

		await mkdir(cacheDir, { recursive: true });
		const tmp = `${path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify({ fileHash, extractorVersion, pagesHash, model, createdAt: new Date().toISOString(), rawOutputs }, null, 2));
		await rename(tmp, path);
	}

	const findings = rawOutputs.flatMap((raw) => parseModelOutput(raw));
	// Long documents are sent in chunks; the first chunk that names a document date wins.
	const documentDate = rawOutputs.map(parseDocumentDate).find(Boolean) ?? null;
	return { findings, documentDate, rawOutputs, fromCache, model };
};
