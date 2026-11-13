import type { PersonalHealthInfo, TimelineEvent, UploadedDocument } from '../types/patient';

const TOKEN_KEY = 'osco.patientToken';
const LEGACY_ACCOUNTS_KEY = 'osco.patientAccounts';
const LEGACY_SESSION_KEY = 'osco.patientSession';
const DATA_KEY = 'osco.patientData';

export interface PatientAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  /** Public Patient ID (OSCO-XXXXXXXX), shown to the patient to give to a doctor */
  publicId?: string;
}

export interface PatientData {
  healthInfo: PersonalHealthInfo;
  documents: UploadedDocument[];
  timelineEvents: TimelineEvent[];
}

const emptyPatientData = (): PatientData => ({
  healthInfo: {
    bloodGroup: '',
    height: '',
    weight: '',
    allergies: [],
    conditions: [],
    otherNotes: '',
    lastUpdated: '',
  },
  documents: [],
  timelineEvents: [],
});

const clearLegacyMockAuth = (): void => {
  localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
};

export const getAuthToken = (): string | null => {
  clearLegacyMockAuth();
  return sessionStorage.getItem(TOKEN_KEY);
};

export const saveAuthToken = (token: string): void => {
  clearLegacyMockAuth();
  sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearAuthToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  clearLegacyMockAuth();
};

const dataStorageKey = (patientId: string): string => `${DATA_KEY}.${patientId}`;

export const loadPatientData = (patientId: string): PatientData => {
  const stored = localStorage.getItem(dataStorageKey(patientId));
  if (!stored) return emptyPatientData();
  const data: unknown = JSON.parse(stored);
  if (!data || typeof data !== 'object') {
    throw new Error('Saved patient information is invalid. Clear this site’s local storage to restart.');
  }
  const patientData = { ...emptyPatientData(), ...(data as Partial<PatientData>) };
  return {
    ...patientData,
    documents: patientData.documents.map((document) =>
      document.status === 'Processing' ? { ...document, status: 'Uploaded' } : document,
    ),
  };
};

export const savePatientData = (patientId: string, data: PatientData): void => {
  localStorage.setItem(dataStorageKey(patientId), JSON.stringify(data));
};