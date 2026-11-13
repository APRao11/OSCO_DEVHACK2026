/**
 * Minimal JSON-mode LLM client for Gemini or Groq (section 8.1).
 *
 * Models get retired and overloaded, so the client tries the configured model
 * first and then each fallback model. A retired (404), overloaded (5xx),
 * rate-limited (429) or timed-out model moves on to the next one. A bad key or
 * bad request (400/401/403) stops at once. If every model fails, the error is
 * thrown so BullMQ retries the job later with backoff.
 */
import { UnrecoverableError } from 'bullmq';

class ModelError extends Error {
	constructor(message, { fatal = false, unavailable = false } = {}) {
		super(message);
		this.fatal = fatal; // will not get better: bad key / bad request
		this.unavailable = unavailable; // this model is gone for this key
	}
}

const withTimeout = async (url, init, timeoutMs) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} catch (error) {
		throw new ModelError(error.name === 'AbortError' ? `timed out after ${Math.round(timeoutMs / 1000)}s` : error.message);
	} finally {
		clearTimeout(timer);
	}
};

const errorFromResponse = async (response) => {
	let detail = '';
	try {
		const body = await response.json();
		detail = body.error?.message ?? JSON.stringify(body).slice(0, 300);
	} catch {
		detail = (await response.text().catch(() => '')).slice(0, 300);
	}
	const message = `HTTP ${response.status}: ${detail.replace(/\s+/g, ' ').trim()}`;
	if ([400, 401, 403].includes(response.status)) return new ModelError(message, { fatal: true });
	return new ModelError(message, { unavailable: response.status === 404 });
};

const callGemini = async ({ apiKey, timeoutMs }, model, { system, user }) => {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
	const response = await withTimeout(
		url,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: system }] },
				contents: [{ role: 'user', parts: [{ text: user }] }],
				generationConfig: { temperature: 0, responseMimeType: 'application/json' },
			}),
		},
		timeoutMs,
	);
	if (!response.ok) throw await errorFromResponse(response);
	const data = await response.json();
	const parts = data.candidates?.[0]?.content?.parts ?? [];
	return parts.map((part) => part.text ?? '').join('');
};

const callGroq = async ({ apiKey, timeoutMs }, model, { system, user }) => {
	const response = await withTimeout(
		'https://api.groq.com/openai/v1/chat/completions',
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				temperature: 0,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user },
				],
			}),
		},
		timeoutMs,
	);
	if (!response.ok) throw await errorFromResponse(response);
	const data = await response.json();
	return data.choices?.[0]?.message?.content ?? '';
};

/**
 * @returns {Promise<{ text: string, model: string }>} the raw text (expected to be JSON) and the model that produced it
 */
export const completeJson = async (llmConfig, prompt) => {
	const provider = llmConfig.provider === 'groq' ? 'Groq' : 'Gemini';
	if (!llmConfig.apiKey) {
		throw new UnrecoverableError(
			`No API key for LLM provider "${llmConfig.provider}". Set ${llmConfig.provider === 'gemini' ? 'GEMINI_API_KEY' : 'GROQ_API_KEY'}.`,
		);
	}

	const models = [...new Set([llmConfig.model, ...(llmConfig.fallbackModels ?? [])])];
	const call = llmConfig.provider === 'groq' ? callGroq : callGemini;
	const failures = [];

	for (const model of models) {
		try {
			return { text: await call(llmConfig, model, prompt), model };
		} catch (error) {
			if (!(error instanceof ModelError)) throw error;
			if (error.fatal) throw new UnrecoverableError(`${provider} rejected the request (${model}): ${error.message}`);
			failures.push({ model, message: error.message, unavailable: error.unavailable });
		}
	}

	const summary = failures.map((f) => `${f.model}: ${f.message}`).join(' | ');
	// Every model is retired for this key: retrying will not help, so fail clearly.
	if (failures.every((f) => f.unavailable)) {
		throw new UnrecoverableError(`No configured ${provider} model is available. Set LLM_MODEL in worker/.env. ${summary}`);
	}
	throw new Error(`All ${provider} models failed, will retry: ${summary}`);
};
