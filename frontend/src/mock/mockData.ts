import type { PatientContext } from '../types/navigation';

export const MOCK_PATIENT: PatientContext = {
  id: 'pt-8812',
  name: 'Elena Vance',
  age: 42,
  gender: 'Female',
  mrn: '940-281-K',
  dob: '1984-06-18',
  primaryCondition: 'Type 2 Diabetes Mellitus with Mild Neuropathy',
  status: 'verified',
  confidence: 98.4,
  lastUpdated: '2026-11-12 18:42 UTC',
};

export const MOCK_PATIENT_STATS = [
  {
    label: 'Verified Timeline Events',
    value: 38,
    unit: 'records',
    code: 'PROV-VERIFIED',
    trend: '100% Sourced',
    trendVariant: 'verified' as const,
  },
  {
    label: 'Contradiction Checks',
    value: '0 Active',
    code: 'CROSS-VERIFY',
    trend: '2 Resolved by Dr. Chen',
    trendVariant: 'neutral' as const,
  },
  {
    label: 'Source Ingestion',
    value: 6,
    unit: 'providers',
    code: 'EPIC / CERNER / LAB',
    trend: 'Sync Nominal',
    trendVariant: 'verified' as const,
  },
  {
    label: 'AI Verification Confidence',
    value: '98.4%',
    code: 'OSCO-LLM-v2',
    trend: 'Confidence Level High',
    trendVariant: 'citron' as const,
    highlightCitron: true,
  },
];

export const MOCK_RECENT_EVENTS = [
  {
    id: 'evt-101',
    date: '2026-10-24',
    title: 'Comprehensive Metabolic Panel (CMP) & HbA1c',
    facility: 'St. Jude Clinical Lab, Palo Alto',
    category: 'Lab Diagnostics',
    confidence: '99.1%',
    verified: true,
    summary: 'HbA1c measured at 6.8% (improved from 7.4%). eGFR stable at 88 mL/min.',
    sources: ['LabCorp Portal', 'Dr. Chen Clinical Note'],
  },
  {
    id: 'evt-102',
    date: '2026-08-14',
    title: 'Medication Reconciliation: Metformin & Empagliflozin',
    facility: 'Bay Health Endocrine Institute',
    category: 'Pharmacotherapy',
    confidence: '97.8%',
    verified: true,
    summary: 'Metformin ER maintained at 1000mg BID. Empagliflozin 10mg morning titration added.',
    sources: ['Surescripts Rx Ledger', 'Endocrinology EHR'],
  },
  {
    id: 'evt-103',
    date: '2026-04-02',
    title: 'Annual Diabetic Retinal Screening',
    facility: 'Pacific Eye & Retina Center',
    category: 'Specialist Screening',
    confidence: '98.5%',
    verified: true,
    summary: 'No microaneurysms or macular edema observed. Recommended follow-up in 12 months.',
    sources: ['Pacific Eye EHR FHIR Bridge'],
  },
];

export const MOCK_DOCTOR_PATIENTS: PatientContext[] = [
  MOCK_PATIENT,
  {
    id: 'pt-9104',
    name: 'Marcus Holloway',
    age: 58,
    gender: 'Male',
    mrn: '731-892-L',
    dob: '1968-03-22',
    primaryCondition: 'Atrial Fibrillation / Statin Myopathy Suspect',
    status: 'needs_review',
    confidence: 89.2,
    lastUpdated: '2026-11-13 01:15 UTC',
  },
  {
    id: 'pt-6402',
    name: 'Sarah Connor',
    age: 36,
    gender: 'Female',
    mrn: '512-109-M',
    dob: '1990-11-05',
    primaryCondition: 'Post-Surgical Arthroscopy / Anti-coagulation Dosage',
    status: 'contradiction',
    confidence: 76.5,
    lastUpdated: '2026-11-12 14:02 UTC',
  },
];
