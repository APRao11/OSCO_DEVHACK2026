/**
 * Doctor access requests (MVP document 5.6, 6.2.2, 8.9).
 *
 * DEMO STORE. The backend does not yet expose POST /api/doctor/access-requests
 * or GET /api/doctor/access-requests/:id, and there is no doctor login, so
 * requests are kept in localStorage with the same shape and lifecycle:
 * pending -> approved | denied | expired. Approval gives read-only access for
 * 60 minutes. Replace these functions with apiRequest() calls when the
 * endpoints exist; FindPatient and PatientRecord only use this interface.
 *
 * Nothing here approves a request by itself: only decideDemoRequest() does,
 * and the UI labels that control as a demo stand-in for the patient's decision.
 */
import { PATIENT } from '../data/emergencyBrief.mock';

const STORE_KEY = 'osco.demo.doctorAccessRequests';
export const ACCESS_WINDOW_MINUTES = 60;
const REQUEST_TTL_HOURS = 24;

/** Limited identification only (6.2.2): no medical data before approval. */
const DIRECTORY = new Map([[PATIENT.publicId, { publicId: PATIENT.publicId, name: PATIENT.name, age: PATIENT.age, sex: PATIENT.sex }]]);

export class AccessError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AccessError';
    this.code = code;
  }
}

const readStore = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const writeStore = (requests) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(requests));
  } catch {
    // Storage unavailable: requests live only for this page load.
  }
};

const minutesFromNow = (iso) => (new Date(iso).getTime() - Date.now()) / 60_000;

/** Apply time-based transitions: pending requests and approved access both expire. */
const withCurrentStatus = (request) => {
  if (request.status === 'pending' && minutesFromNow(request.requestedAt) < -REQUEST_TTL_HOURS * 60) {
    return { ...request, status: 'expired' };
  }
  if (request.status === 'approved' && minutesFromNow(request.accessExpiresAt) <= 0) {
    return { ...request, status: 'expired' };
  }
  return request;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const normalisePatientId = (raw) => raw.trim().toUpperCase().replace(/\s+/g, '');

/**
 * Look up the Patient ID and submit an access request in one step.
 * @returns {Promise<object>} the pending request, with the patient's limited identification
 */
export async function submitAccessRequest({ patientId, reason }) {
  await delay(400);
  const id = normalisePatientId(patientId);
  const patient = DIRECTORY.get(id);
  if (!patient) throw new AccessError('NOT_FOUND', 'No patient found with this ID. Check the ID and try again.');

  const request = {
    id: crypto.randomUUID(),
    patientId: id,
    patient,
    reason,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    decidedAt: null,
    accessExpiresAt: null,
  };
  writeStore([...readStore().map(withCurrentStatus), request]);
  return request;
}

/** Current state of one request (polled by the waiting screen). */
export async function getAccessRequest(requestId) {
  await delay(150);
  const request = readStore().find((r) => r.id === requestId);
  if (!request) throw new AccessError('NOT_FOUND', 'This access request no longer exists.');
  return withCurrentStatus(request);
}

/** Withdraw a request that is still pending. */
export async function cancelAccessRequest(requestId) {
  writeStore(readStore().filter((r) => r.id !== requestId || r.status !== 'pending'));
}

/** The approved, unexpired access for this patient, if any (read synchronously by PatientRecord). */
export function getActiveAccess(patientId) {
  const now = Date.now();
  return (
    readStore()
      .map(withCurrentStatus)
      .filter((r) => r.patientId === patientId && r.status === 'approved' && new Date(r.accessExpiresAt).getTime() > now)
      .sort((a, b) => b.accessExpiresAt.localeCompare(a.accessExpiresAt))[0] ?? null
  );
}

/**
 * DEMO ONLY: stands in for the patient pressing Approve or Deny in their
 * portal, until the patient-side access requests panel calls
 * POST /api/access/:id/approve | /deny on the backend.
 */
export async function decideDemoRequest(requestId, decision) {
  const now = new Date();
  writeStore(
    readStore().map((r) =>
      r.id === requestId && r.status === 'pending'
        ? {
            ...r,
            status: decision === 'approve' ? 'approved' : 'denied',
            decidedAt: now.toISOString(),
            accessExpiresAt: decision === 'approve' ? new Date(now.getTime() + ACCESS_WINDOW_MINUTES * 60_000).toISOString() : null,
          }
        : r,
    ),
  );
}

export const ACCESS_STORE_KEY = STORE_KEY;
