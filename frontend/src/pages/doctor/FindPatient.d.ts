import type { ReactElement } from 'react';

export interface ApprovedAccessRequest {
  id: string;
  patientId: string;
  patient: { publicId: string; name: string; age: number; sex: string };
  reason: string;
  status: 'approved';
  requestedAt: string;
  decidedAt: string;
  accessExpiresAt: string;
}

export default function FindPatient(props: { onApproved: (request: ApprovedAccessRequest) => void }): ReactElement;
