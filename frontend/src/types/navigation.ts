export type PortalType = 'patient' | 'doctor';

export interface NavItem {
  id: string;
  label: string;
  iconName: string;
  badge?: string;
  badgeVariant?: 'neutral' | 'citron' | 'warning' | 'eucalyptus';
  isPatientContextOnly?: boolean;
}

export interface PatientContext {
  id: string;
  name: string;
  age: number;
  gender: string;
  mrn: string;
  dob: string;
  primaryCondition: string;
  status: 'verified' | 'needs_review' | 'contradiction';
  confidence: number;
  lastUpdated: string;
}

export const PATIENT_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
  { id: 'medical-history', label: 'Medical History', iconName: 'Activity' },
  { id: 'documents', label: 'Documents', iconName: 'FileText' },
  { id: 'upload', label: 'Upload Documents', iconName: 'UploadCloud' },
  { id: 'health-assistant', label: 'Health Assistant', iconName: 'Sparkles' },
  { id: 'health-details', label: 'Health Details', iconName: 'User' },
];

export const DOCTOR_NAV_ITEMS: NavItem[] = [
  { id: 'emergency-brief', label: 'Emergency Brief', iconName: 'ShieldAlert', isPatientContextOnly: true },
  { id: 'medical-history', label: 'Medical History', iconName: 'History', isPatientContextOnly: true },
  { id: 'documents', label: 'Documents', iconName: 'Files', isPatientContextOnly: true },
  { id: 'review-verification', label: 'Review & Verification', iconName: 'ShieldCheck', isPatientContextOnly: true },
  { id: 'add-record', label: 'Add Clinical Record', iconName: 'PlusCircle', isPatientContextOnly: true },
  { id: 'health-assistant', label: 'Doctor Assistant', iconName: 'Sparkles', isPatientContextOnly: true },
];
