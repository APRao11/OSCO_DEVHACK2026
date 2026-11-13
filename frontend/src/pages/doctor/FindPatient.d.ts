import type { ReactElement } from 'react';

export interface ApprovedAccessRequest {
  id: string;
  /** True for the local sample patient (mock Report); false for real patients */
  demo: boolean;
  patientId: string;
  patient: { publicId: string; name: string; age: number | null; sex: string | null };
  reason: string;
  requestedAccess: 'read' | 'edit';
  status: 'approved';
  requestedAt: string;
  decidedAt: string;
  /** What the patient granted: 'read' (view) or 'edit' (view and correct) */
  accessLevel: 'read' | 'edit';
  accessExpiresAt: string;
}

export default function FindPatient(props: { onApproved: (request: ApprovedAccessRequest) => void }): ReactElement;
