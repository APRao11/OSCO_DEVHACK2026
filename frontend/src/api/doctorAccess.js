/**
 * Doctor access requests (MVP document 5.6, 6.2.2, 8.9), used by FindPatient
 * and PatientRecord.
 *
 * Real Patient IDs (OSCO-XXXXXXXX) go to the backend: the patient approves or
 * denies on their own dashboard, and approval opens a 60-minute session at the
 * level they chose ("read" = view, "edit" = view and correct).
 *
 * The sample patient from src/data/emergencyBrief.mock.js keeps its local demo
 * flow (with a labelled "patient approves" stand-in) so the Report mock-up can
 * still be shown. Nothing here approves a real request.
 */
import { PATIENT } from '../data/emergencyBrief.mock';
import { createAccessRequest, getAccessRequestStatus } from './doctorApi.js';

export const ACCESS_WINDOW_MINUTES = 60;
export const DEMO_PATIENT_ID = PATIENT.publicId;

const DEMO_STORE_KEY = 'osco.demo.doctorAccessRequests';
const ACCESS_KEY = 'osco.doctorAccess'; // approved real sessions: { [publicId]: { accessLevel, expiresAt } }
export const ACCESS_STORE_KEY = DEMO_STORE_KEY;

export class AccessError extends Error {
	constructor(code, message) {
		super(message);
		this.name = 'AccessError';
		this.code = code;
	}
}

export const normalisePatientId = (raw) => raw.trim().toUpperCase().replace(/\s+/g, '');
export const isDemoPatient = (patientId) => normalisePatientId(patientId) === DEMO_PATIENT_ID;

const readJson = (storage, key, fallback) => {
	try {
		return JSON.parse(storage.getItem(key) ?? 'null') ?? fallback;
	} catch {
		return fallback;
	}
};
const writeJson = (storage, key, value) => {
	try {
		storage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage unavailable: lasts for this page only.
	}
};

// ------------------------------------------------------------ real (backend)

/** Remember an approved session so PatientRecord can show the countdown. The server still checks every request. */
const rememberAccess = (request) => {
	if (request.status !== 'approved' || !request.session?.active) return;
	const map = readJson(sessionStorage, ACCESS_KEY, {});
	map[request.patient.publicId] = { accessLevel: request.session.accessLevel, expiresAt: request.session.expiresAt };
	writeJson(sessionStorage, ACCESS_KEY, map);
};

/** Forget a session the server says has ended. */
export const forgetAccess = (patientId) => {
	const map = readJson(sessionStorage, ACCESS_KEY, {});
	delete map[normalisePatientId(patientId)];
	writeJson(sessionStorage, ACCESS_KEY, map);
};

/** Shape both real and demo requests the same way for the UI. */
const fromServer = (request) => ({
	id: request.id,
	demo: false,
	patientId: request.patient.publicId,
	patient: { publicId: request.patient.publicId, name: request.patient.name, age: null, sex: null },
	reason: request.purpose,
	requestedAccess: request.requestedAccess,
	status: request.status,
	requestedAt: request.requestedAt,
	decidedAt: request.decidedAt,
	accessLevel: request.session?.accessLevel ?? null,
	accessExpiresAt: request.session?.expiresAt ?? null,
});

// ------------------------------------------------------------ demo (sample patient)

const DEMO_PATIENT = { publicId: PATIENT.publicId, name: PATIENT.name, age: PATIENT.age, sex: PATIENT.sex };
const readDemo = () => readJson(localStorage, DEMO_STORE_KEY, []);
const writeDemo = (list) => writeJson(localStorage, DEMO_STORE_KEY, list);
const minutesFromNow = (iso) => (new Date(iso).getTime() - Date.now()) / 60_000;
const demoStatus = (r) => (r.status === 'approved' && minutesFromNow(r.accessExpiresAt) <= 0 ? { ...r, status: 'expired' } : r);

// ------------------------------------------------------------ interface used by the pages

/**
 * Submit an access request for a Patient ID.
 * @param {{ patientId: string, reason: string, access?: 'read' | 'edit' }} input
 */
export async function submitAccessRequest({ patientId, reason, access = 'read' }) {
	const id = normalisePatientId(patientId);
	if (id === DEMO_PATIENT_ID) {
		const request = {
			id: crypto.randomUUID(), demo: true, patientId: id, patient: DEMO_PATIENT, reason, requestedAccess: access,
			status: 'pending', requestedAt: new Date().toISOString(), decidedAt: null, accessLevel: null, accessExpiresAt: null,
		};
		writeDemo([...readDemo(), request]);
		return request;
	}
	try {
		const { data } = await createAccessRequest({ patientId: id, purpose: reason, access });
		return fromServer(data.request);
	} catch (error) {
		throw new AccessError(error.status === 404 ? 'NOT_FOUND' : 'FAILED', error.message || 'The request could not be sent. Try again.');
	}
}

/** Current state of one request (polled while waiting). */
export async function getAccessRequest(requestId, { demo = false } = {}) {
	if (demo) {
		const request = readDemo().find((r) => r.id === requestId);
		if (!request) throw new AccessError('NOT_FOUND', 'This access request no longer exists.');
		return demoStatus(request);
	}
	const { data } = await getAccessRequestStatus(requestId);
	rememberAccess(data.request);
	return fromServer(data.request);
}

/** Stop waiting. A real request stays on record (consent history is kept) and simply expires. */
export async function cancelAccessRequest(requestId, { demo = false } = {}) {
	if (demo) writeDemo(readDemo().filter((r) => r.id !== requestId || r.status !== 'pending'));
}

/**
 * The approved, unexpired access this doctor holds for a patient, or null.
 * Used for the countdown only; the server re-checks consent on every request.
 */
export function getActiveAccess(patientId) {
	const id = normalisePatientId(patientId);
	if (id === DEMO_PATIENT_ID) {
		return (
			readDemo()
				.map(demoStatus)
				.filter((r) => r.status === 'approved')
				.sort((a, b) => b.accessExpiresAt.localeCompare(a.accessExpiresAt))[0] ?? null
		);
	}
	const access = readJson(sessionStorage, ACCESS_KEY, {})[id];
	if (!access || minutesFromNow(access.expiresAt) <= 0) return null;
	return { patientId: id, accessLevel: access.accessLevel, accessExpiresAt: access.expiresAt };
}

/** DEMO ONLY: stands in for the sample patient's decision. */
export async function decideDemoRequest(requestId, decision) {
	const now = new Date();
	writeDemo(
		readDemo().map((r) =>
			r.id === requestId && r.status === 'pending'
				? {
						...r,
						status: decision === 'approve' ? 'approved' : 'denied',
						decidedAt: now.toISOString(),
						accessLevel: decision === 'approve' ? 'read' : null,
						accessExpiresAt: decision === 'approve' ? new Date(now.getTime() + ACCESS_WINDOW_MINUTES * 60_000).toISOString() : null,
					}
				: r,
		),
	);
}
