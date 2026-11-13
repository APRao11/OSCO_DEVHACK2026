import type { ApprovedAccessRequest } from '../pages/doctor/FindPatient';

export const ACCESS_WINDOW_MINUTES: number;
export const DEMO_PATIENT_ID: string;
export const ACCESS_STORE_KEY: string;

export class AccessError extends Error {
  code: string;
}

export function normalisePatientId(raw: string): string;
export function isDemoPatient(patientId: string): boolean;
export function forgetAccess(patientId: string): void;
export function submitAccessRequest(input: { patientId: string; reason: string; access?: 'read' | 'edit' }): Promise<ApprovedAccessRequest>;
export function getAccessRequest(requestId: string, options?: { demo?: boolean }): Promise<ApprovedAccessRequest>;
export function cancelAccessRequest(requestId: string, options?: { demo?: boolean }): Promise<void>;
export function getActiveAccess(patientId: string): { patientId: string; accessLevel: 'read' | 'edit'; accessExpiresAt: string } | null;
export function decideDemoRequest(requestId: string, decision: 'approve' | 'deny'): Promise<void>;
export function listMyAccessRequests(): Promise<ApprovedAccessRequest[]>;
