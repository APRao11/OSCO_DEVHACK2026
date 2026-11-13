import type { DoctorProfile } from '../auth/doctorSession';
import type { PatientRecords } from '../types/records';
import type { ReviewApi } from '../components/patient/reviewApi';

export interface DoctorAccessRequest {
  id: string;
  status: 'pending' | 'approved' | 'denied' | 'expired' | 'ended';
  purpose: string;
  requestedAccess: 'read' | 'edit';
  approvedAccess: 'read' | 'edit' | null;
  requestedAt: string;
  decidedAt: string | null;
  patient: { publicId: string; name: string };
  session: { accessLevel: 'read' | 'edit'; startedAt: string; expiresAt: string; active: boolean } | null;
}

export function loginDoctor(input: { email: string; password: string }): Promise<{ data: { token: string; doctor: DoctorProfile } }>;
export function lookupPatient(patientId: string): Promise<{ data: { patient: { publicId: string; name: string } } }>;
export function createAccessRequest(input: { patientId: string; purpose: string; access: 'read' | 'edit' }): Promise<{ data: { request: DoctorAccessRequest } }>;
export function getAccessRequestStatus(requestId: string): Promise<{ data: { request: DoctorAccessRequest } }>;
export function getPatientRecords(publicId: string): Promise<{
  data: PatientRecords & { access: { level: 'read' | 'edit'; expiresAt: string } };
}>;
export function doctorReviewApi(publicId: string): ReviewApi;
export function doctorAuthHeader(): Record<string, string>;
