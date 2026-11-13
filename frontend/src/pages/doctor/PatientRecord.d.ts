import type { ComponentType, ReactElement } from 'react';

export interface RecordSection {
  navId: 'emergency-brief' | 'medical-history' | 'review-verification' | 'add-record';
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const RECORD_SECTIONS: RecordSection[];

export default function PatientRecord(props: {
  patient: import('../../types/navigation').PatientContext;
  activeNavId: string;
  onNavigate: (navId: string) => void;
  onAccessEnded: () => void;
}): ReactElement | null;
