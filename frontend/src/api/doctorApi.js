import { apiRequest } from './client.js';
import { getDoctorToken } from '../auth/doctorSession';

/**
 * Doctor API (MVP document 8.9). Every call sends the doctor's token; the
 * server re-checks verification and the patient's consent on each request.
 */

const auth = () => {
	const token = getDoctorToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
};

/** @param {{ email: string, password: string }} input */
export const loginDoctor = (input) => apiRequest('/api/auth/doctor/login', { method: 'POST', body: JSON.stringify(input) });

/** Limited identification for a Patient ID (name only, no medical data). @param {string} patientId */
export const lookupPatient = (patientId) =>
	apiRequest('/api/doctor/lookup', { method: 'POST', body: JSON.stringify({ patientId }), headers: auth() });

/** @param {{ patientId: string, purpose: string, access: 'read' | 'edit' }} input */
export const createAccessRequest = (input) =>
	apiRequest('/api/doctor/access-requests', { method: 'POST', body: JSON.stringify(input), headers: auth() });

/** @param {string} requestId */
export const getAccessRequestStatus = (requestId) =>
	apiRequest(`/api/doctor/access-requests/${encodeURIComponent(requestId)}`, { headers: auth() });

const patientPath = (publicId) => `/api/doctor/patients/${encodeURIComponent(publicId)}`;

/** The patient's medical history (confirmed findings), plus this doctor's current access. @param {string} publicId */
export const getPatientRecords = (publicId) => apiRequest(`${patientPath(publicId)}/records`, { headers: auth() });

/**
 * The same review operations the patient dashboard uses, scoped to one patient
 * and acting as the doctor. Shape matches FindingsReview's `api` prop.
 * @param {string} publicId
 */
export const doctorReviewApi = (publicId) => {
	const finding = (documentId, findingId) =>
		`${patientPath(publicId)}/documents/${encodeURIComponent(documentId)}/findings/${encodeURIComponent(findingId)}`;
	return {
		load: (documentId) => apiRequest(`${patientPath(publicId)}/documents/${encodeURIComponent(documentId)}`, { headers: auth() }),
		edit: (documentId, findingId, changes) =>
			apiRequest(finding(documentId, findingId), { method: 'PATCH', body: JSON.stringify(changes), headers: auth() }),
		dismiss: (documentId, findingId) => apiRequest(`${finding(documentId, findingId)}/dismiss`, { method: 'POST', headers: auth() }),
		restore: (documentId, findingId) => apiRequest(`${finding(documentId, findingId)}/restore`, { method: 'POST', headers: auth() }),
		confirm: null, // adding findings to the history is the patient's decision
	};
};

/** The Authorization header for clients that fetch on their own (pdf.js in the Source Viewer). */
export const doctorAuthHeader = auth;
