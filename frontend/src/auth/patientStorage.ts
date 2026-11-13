import type { PersonalHealthInfo, TimelineEvent, UploadedDocument } from '../types/patient';

const ACCOUNTS_KEY = 'osco.patientAccounts';
const SESSION_KEY = 'osco.patientSession';
const DATA_KEY = 'osco.patientData';

export interface PatientAccount {
  id: string;
  name: string;
  email: string;
  password: string;
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

const readAccounts = (): PatientAccount[] => {
  const stored = localStorage.getItem(ACCOUNTS_KEY);
  if (!stored) return [];
  const accounts: unknown = JSON.parse(stored);
  if (!Array.isArray(accounts)) {
    throw new Error('Saved demo accounts are invalid. Clear this site’s local storage to restart.');
  }
  return accounts as PatientAccount[];
};

export const getCurrentPatient = (): PatientAccount | null => {
  const patientId = localStorage.getItem(SESSION_KEY);
  if (!patientId) return null;
  return readAccounts().find((account) => account.id === patientId) ?? null;
};

export const findPatientAccountById = (patientId: string): PatientAccount | null => {
  const normalizedId = patientId.trim().toLowerCase();
  if (!normalizedId) return null;
  return readAccounts().find((account) => account.id.toLowerCase() === normalizedId) ?? null;
};

export const registerPatient = (
  name: string,
  email: string,
  password: string,
): PatientAccount => {
  if (!name.trim()) throw new Error('Please enter your full name.');
  const accounts = readAccounts();
  const normalizedEmail = email.trim().toLowerCase();
  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  let id: string;
  do {
    id = `OSCO-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  } while (accounts.some((account) => account.id === id));

  const account = { id, name: name.trim(), email: normalizedEmail, password };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
};

export const loginPatient = (email: string, password: string): PatientAccount => {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readAccounts().find(
    (saved) => saved.email === normalizedEmail && saved.password === password,
  );
  if (!account) throw new Error('Email or password is incorrect.');
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
};

export const logoutPatient = (): void => {
  localStorage.removeItem(SESSION_KEY);
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