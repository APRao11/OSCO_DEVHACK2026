import { apiRequest } from './client.js';

/** @typedef {{ status: string, timestamp?: string }} HealthResponse */
/** @typedef {{ id: string, name: string, email: string, createdAt: string }} PatientProfile */
/** @typedef {{ token: string, patient: PatientProfile }} PatientAuthResponse */

/** Check the backend's public health endpoint. */
export const getBackendHealth = () => apiRequest('/health');

/** @param {{ name: string, email: string, password: string }} input */
export const registerPatient = (input) =>
	apiRequest('/api/auth/patient/register', { method: 'POST', body: JSON.stringify(input) });

/** @param {{ email: string, password: string }} input */
export const loginPatient = (input) =>
	apiRequest('/api/auth/patient/login', { method: 'POST', body: JSON.stringify(input) });

/** @param {string} token */
export const getPatientProfile = (token) =>
	apiRequest('/api/patients/me', { headers: { Authorization: `Bearer ${token}` } });

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Upload PDFs or images for processing (POST /api/documents).
 * @param {string} token
 * @param {File[]} files
 */
export const uploadDocuments = (token, files) => {
	const body = new FormData();
	for (const file of files) body.append('files', file, file.name);
	return apiRequest('/api/documents', { method: 'POST', body, headers: authHeader(token) });
};

/** @param {string} token */
export const listDocuments = (token) => apiRequest('/api/documents', { headers: authHeader(token) });

/** One document with its verified findings. @param {string} token @param {string} documentId */
export const getDocumentFindings = (token, documentId) =>
	apiRequest(`/api/documents/${encodeURIComponent(documentId)}`, { headers: authHeader(token) });

/** Queue a failed or never-queued document again. @param {string} token @param {string} documentId */
export const retryDocument = (token, documentId) =>
	apiRequest(`/api/documents/${encodeURIComponent(documentId)}/retry`, { method: 'POST', headers: authHeader(token) });
