const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/** Base URL for the OSCO API, without a trailing slash. */
export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, '');

/** @typedef {{ status: number, message: string }} ApiErrorDetails */

export class ApiError extends Error {
	/**
	 * @param {string} message
	 * @param {number} status
	 */
	constructor(message, status) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

/**
 * Send a request to the configured backend and parse its JSON response.
 * @template T
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<T>}
 */
export async function apiRequest(path, options = {}) {
	const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
		...options,
		headers: {
			Accept: 'application/json',
			...(options.body ? { 'Content-Type': 'application/json' } : {}),
			...options.headers,
		},
	});

	const body = await response.json().catch(() => null);
	if (!response.ok) {
		const message = body?.error?.message || `Backend request failed with status ${response.status}.`;
		throw new ApiError(message, response.status);
	}

	return /** @type {T} */ (body);
}
