// Imported for its side effect: loads backend/.env before the settings below are read.
import '../config/env.js';

/**
 * Minimal JSON-mode LLM client for the chatbot, following the worker's pattern
 * (worker/src/llm/client.js): Gemini or Groq, the configured model first, then
 * fallbacks when a model is retired, overloaded, rate-limited or slow.
 * Keys are read from backend/.env and never sent to the browser.
 */

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').trim().toLowerCase();
const API_KEY = (PROVIDER === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY)?.trim() || '';
const MODELS = [
	process.env.LLM_MODEL?.trim() || (PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-3.6-flash'),
	...(process.env.LLM_FALLBACK_MODELS ?? (PROVIDER === 'groq' ? '' : 'gemini-3.5-flash,gemini-3.5-flash-lite'))
		.split(',')
		.map((m) => m.trim())
		.filter(Boolean),
];
// Chat is interactive: a slow model is abandoned quickly and the next one tried,
// all within one overall deadline so the user never waits much over a minute.
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 15_000;
const DEADLINE_MS = Math.max(TIMEOUT_MS, Number(process.env.LLM_DEADLINE_MS) || 45_000);
const COOLDOWN_MS = 5 * 60_000;
/** model -> time until which it is skipped after a timeout, rate limit or overload */
const coolingDown = new Map();

export class LlmError extends Error {
	constructor(message, { configuration = false } = {}) {
		super(message);
		this.configuration = configuration;
	}
}

export const llmConfigured = () => Boolean(API_KEY);

const post = async (url, headers, body, timeoutMs = TIMEOUT_MS) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
		if (!response.ok) {
			const detail = await response.json().catch(() => ({}));
			const error = new Error(`HTTP ${response.status}: ${detail.error?.message ?? 'request failed'}`.slice(0, 300));
			error.status = response.status;
			throw error;
		}
		return await response.json();
	} catch (error) {
		if (error.name === 'AbortError') throw Object.assign(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s`), { status: 504 });
		throw error;
	} finally {
		clearTimeout(timer);
	}
};

const callOnce = async (model, { system, user }, timeoutMs) => {
	if (PROVIDER === 'groq') {
		const data = await post('https://api.groq.com/openai/v1/chat/completions', { authorization: `Bearer ${API_KEY}` }, {
			model,
			temperature: 0,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user },
			],
		}, timeoutMs);
		return data.choices?.[0]?.message?.content ?? '';
	}
	const data = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': API_KEY }, {
		systemInstruction: { parts: [{ text: system }] },
		contents: [{ role: 'user', parts: [{ text: user }] }],
		generationConfig: { temperature: 0, responseMimeType: 'application/json' },
	}, timeoutMs);
	return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
};

/**
 * @returns {Promise<{ text: string, model: string }>}
 * @throws {LlmError} when no key is configured or every model failed
 */
export const completeJson = async (prompt) => {
	if (!API_KEY) throw new LlmError('The assistant is not configured on the server (no LLM API key).', { configuration: true });
	const failures = [];
	const started = Date.now();
	const unique = [...new Set(MODELS)];
	// Models that failed recently go last rather than first; if all are cooling down, all are tried.
	const ordered = [...unique.filter((m) => !(coolingDown.get(m) > Date.now())), ...unique.filter((m) => coolingDown.get(m) > Date.now())];
	for (const model of ordered) {
		const left = DEADLINE_MS - (Date.now() - started);
		if (left < 3_000) {
			failures.push('overall time limit reached');
			break;
		}
		try {
			const text = await callOnce(model, prompt, Math.min(TIMEOUT_MS, left));
			coolingDown.delete(model);
			return { text, model };
		} catch (error) {
			if ([429, 500, 502, 503, 504, 404].includes(error.status) || !error.status) coolingDown.set(model, Date.now() + COOLDOWN_MS);
			// A bad key or bad request will not get better with another model.
			if ([400, 401, 403].includes(error.status)) throw new LlmError(`The AI provider rejected the request (${error.status}).`, { configuration: error.status !== 400 });
			failures.push(`${model}: ${error.message}`);
		}
	}
	throw new LlmError(`The AI provider is unavailable right now. ${failures.join(' | ')}`.slice(0, 500));
};
