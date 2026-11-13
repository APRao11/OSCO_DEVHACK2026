/**
 * Step 4 - Extract: the LLM returns findings as JSON, each with a verbatim quote
 * and a page. Results are cached by file hash + extractor_version (section 8.3)
 * so re-runs, demos and evaluation are repeatable even if the API is down.
 */
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

const cachePath = (cacheDir, fileHash, extractorVersion) =>
	join(cacheDir, `${fileHash}_${extractorVersion.replace(/[^\w.-]/g, '_')}.json`);

const readCache = async (path) => {
	try {
		return JSON.parse(await readFile(path, 'utf8'));
	} catch {
		return null;
	}
};

/**
 * @returns {Promise<{ findings: object[], rawOutputs: string[], fromCache: boolean, model: string }>}
 *   findings are the objects exactly as the model returned them.
 */
export const extract = async ({ fileHash, extractorVersion, documentType, pages }, { llm, cacheDir }) => {
	const path = cachePath(cacheDir, fileHash, extractorVersion);
	const cached = await readCache(path);

	let rawOutputs;
	let model;
	let fromCache = false;
	if (cached?.fileHash === fileHash && cached?.extractorVersion === extractorVersion && Array.isArray(cached.rawOutputs)) {
		rawOutputs = cached.rawOutputs;
		model = cached.model;
		fromCache = true;
	} else {
		const withText = pages.filter((page) => page.text.trim());
		rawOutputs = [];
		for (const chunk of chunkPages(withText, llm.maxCharsPerCall)) {
			const raw = await completeJson(llm, { system: SYSTEM_PROMPT, user: buildUserPrompt({ documentType, pages: chunk }) });
			parseModelOutput(raw); // validate before caching; throws -> job retries
			rawOutputs.push(raw);
		}
		model = `${llm.provider}:${llm.model}`;

		await mkdir(cacheDir, { recursive: true });
		const tmp = `${path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify({ fileHash, extractorVersion, model, createdAt: new Date().toISOString(), rawOutputs }, null, 2));
		await rename(tmp, path);
	}

	const findings = rawOutputs.flatMap((raw) => parseModelOutput(raw));
	return { findings, rawOutputs, fromCache, model };
};
