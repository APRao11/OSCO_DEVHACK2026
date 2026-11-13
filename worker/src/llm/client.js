/**
 * Minimal JSON-mode LLM client for Gemini or Groq (section 8.1).
 * Throws on transport/HTTP errors so BullMQ retries the job with backoff.
 */
import { UnrecoverableError } from 'bullmq';

const withTimeout = async (url, init, timeoutMs) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
};

const failFromResponse = async (provider, response) => {
	const body = (await response.text()).slice(0, 500);
	const message = `${provider} API error ${response.status}: ${body}`;
	// Bad key or bad request will not get better on retry; 429 and 5xx might.
	if ([400, 401, 403, 404].includes(response.status)) throw new UnrecoverableError(message);
	throw new Error(message);
};

const callGemini = async ({ apiKey, model, timeoutMs }, { system, user }) => {
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
	if (!response.ok) await failFromResponse('Gemini', response);
	const data = await response.json();
	const parts = data.candidates?.[0]?.content?.parts ?? [];
	return parts.map((part) => part.text ?? '').join('');
};

const callGroq = async ({ apiKey, model, timeoutMs }, { system, user }) => {
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
	if (!response.ok) await failFromResponse('Groq', response);
	const data = await response.json();
	return data.choices?.[0]?.message?.content ?? '';
};

/**
 * @returns {Promise<string>} the raw text the model returned (expected to be JSON)
 */
export const completeJson = async (llmConfig, prompt) => {
	if (!llmConfig.apiKey) {
		throw new UnrecoverableError(
			`No API key for LLM provider "${llmConfig.provider}". Set ${llmConfig.provider === 'gemini' ? 'GEMINI_API_KEY' : 'GROQ_API_KEY'}.`,
		);
	}
	return llmConfig.provider === 'groq' ? callGroq(llmConfig, prompt) : callGemini(llmConfig, prompt);
};
