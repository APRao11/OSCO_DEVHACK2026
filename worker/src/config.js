import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(workerRoot, '.env') });

const int = (value, fallback, name) => {
	if (value === undefined || value === '') return fallback;
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer.`);
	return n;
};

const required = (name) => {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable ${name}.`);
	return value;
};

const llmProvider = (process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
if (!['gemini', 'groq'].includes(llmProvider)) {
	throw new Error('LLM_PROVIDER must be gemini or groq.');
}

export const config = Object.freeze({
	databaseUrl: required('DATABASE_URL'),
	redisUrl: process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379',

	// Must point at the same directory the backend writes originals to.
	documentStorageDir: resolve(workerRoot, process.env.DOCUMENT_STORAGE_DIR || '../backend/storage/originals'),
	cacheDir: resolve(workerRoot, process.env.EXTRACTION_CACHE_DIR || 'src/cache'),

	// Section 8.3: "about 2 to 3 jobs at once", limited retries with backoff.
	concurrency: int(process.env.WORKER_CONCURRENCY, 3, 'WORKER_CONCURRENCY'),
	reconcileConcurrency: int(process.env.RECONCILE_CONCURRENCY, 2, 'RECONCILE_CONCURRENCY'),
	jobAttempts: int(process.env.JOB_ATTEMPTS, 3, 'JOB_ATTEMPTS'),
	backoffMs: int(process.env.JOB_BACKOFF_MS, 5_000, 'JOB_BACKOFF_MS'),
	// BullMQ rate limiter guarding the LLM API: at most N jobs per window.
	rateLimitMax: int(process.env.LLM_RATE_LIMIT_MAX, 10, 'LLM_RATE_LIMIT_MAX'),
	rateLimitWindowMs: int(process.env.LLM_RATE_LIMIT_WINDOW_MS, 60_000, 'LLM_RATE_LIMIT_WINDOW_MS'),

	extractorVersion: process.env.EXTRACTOR_VERSION?.trim() || 'v1',

	llm: Object.freeze({
		provider: llmProvider,
		apiKey: llmProvider === 'gemini' ? process.env.GEMINI_API_KEY?.trim() : process.env.GROQ_API_KEY?.trim(),
		model:
			process.env.LLM_MODEL?.trim() ||
			(llmProvider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile'),
		timeoutMs: int(process.env.LLM_TIMEOUT_MS, 120_000, 'LLM_TIMEOUT_MS'),
		// Characters of page text sent per LLM call; longer documents are split on page boundaries.
		maxCharsPerCall: int(process.env.LLM_MAX_CHARS_PER_CALL, 24_000, 'LLM_MAX_CHARS_PER_CALL'),
	}),

	ocr: Object.freeze({
		tesseractPath: process.env.TESSERACT_PATH?.trim() || 'tesseract',
		language: process.env.TESSERACT_LANG?.trim() || 'eng',
		// A PDF page with fewer non-space characters than this in its text layer is treated as a scan.
		minTextLayerChars: int(process.env.MIN_TEXT_LAYER_CHARS, 20, 'MIN_TEXT_LAYER_CHARS'),
		renderScale: Number(process.env.OCR_RENDER_SCALE || 2),
	}),

	verifier: Object.freeze({
		minQuoteChars: int(process.env.QUOTE_MIN_CHARS, 8, 'QUOTE_MIN_CHARS'),
		maxQuoteChars: int(process.env.QUOTE_MAX_CHARS, 300, 'QUOTE_MAX_CHARS'),
	}),

	// 'dmy' or 'mdy' resolves dates like 04/05/2021. Unset = store both readings and flag.
	dateLocaleHint: process.env.DATE_LOCALE_HINT?.trim() || null,
});
