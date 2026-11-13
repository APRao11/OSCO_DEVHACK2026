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
