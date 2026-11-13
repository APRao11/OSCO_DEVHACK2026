import type { PatientContext } from '../types/navigation';
import type { ReviewItem, MissingInfoGap } from '../types/doctor';

export const DOCTOR_PATIENTS_LIST: PatientContext[] = [
  {
    id: 'pt-8812',
    name: 'Elena Vance',
    age: 42,
    gender: 'Female',
    mrn: '940-281-K',
    dob: '1984-06-18',
    primaryCondition: 'Type 2 Diabetes Mellitus with Mild Neuropathy',
    status: 'contradiction',
    confidence: 98.4,
    lastUpdated: '2026-11-12 18:42 UTC',
  },
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
    status: 'verified',
    confidence: 97.5,
    lastUpdated: '2026-11-12 14:02 UTC',
  },
];

export const INITIAL_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: 'REV-001',
    type: 'contradiction',
    title: 'Discrepancy in Metformin Dosage Formulation',
    category: 'Pharmacotherapy Dosage',
    description:
      'Discharge summary from St. Jude Medical Center documents Metformin 500mg BID, whereas outpatient pharmacy ledger and longitudinal progress notes document Metformin ER 1000mg BID.',
    severity: 'high',
    sourceA: {
      docName: 'Discharge_Summary_StJude_2026.pdf',
      page: 2,
      facility: 'St. Jude Medical Center',
      date: '2026-10-24',
      value: 'Metformin 500mg oral tablet twice daily with meals',
    },
    sourceB: {
      docName: 'Pharmacy_Rx_Ledger_Q1_2026.pdf',
      page: 1,
      facility: 'Walgreens Pharmacy #04128',
      date: '2026-03-10',
      value: 'Metformin ER 1000mg oral tablet twice daily with meals',
    },
    confidence: 94.2,
    status: 'unverified',
  },
  {
    id: 'REV-002',
    type: 'uncertain_extraction',
    title: 'Neuropathy Onset Date Ambiguity',
    category: 'Specialist Diagnosis',
    description:
      'Specialist consultation note mentions "mild sensory loss for approx. 14 months", whereas primary care note logged first complaint in November 2025. OCR extraction tagged onset date as provisional.',
    severity: 'medium',
    sourceA: {
      docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
      page: 2,
      facility: 'Bay Health Endocrine Institute',
      date: '2026-08-14',
      value: 'Onset estimated ~May 2025 (self-reported)',
    },
    confidence: 81.5,
    status: 'unverified',
  },
  {
    id: 'REV-003',
    type: 'duplicate',
    title: 'Duplicate Observation Encounter — Retinopathy Exam',
    category: 'Imaging Screening',
    description:
      'Identical dilated retinal screening observation ingested from both Pacific Eye EHR archive and Bay Health Referral bridge with matching timestamps and findings.',
    severity: 'low',
    sourceA: {
      docName: 'Annual_Retinal_Screening_Report.pdf',
      page: 1,
      facility: 'Pacific Eye & Retina Center',
      date: '2026-04-02',
      value: 'Fundus exam: No diabetic retinopathy detected bilaterally',
    },
    sourceB: {
      docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
      page: 3,
      facility: 'Bay Health Bridge EHR',
      date: '2026-04-02',
      value: 'External consult import: Eye exam negative',
    },
    confidence: 99.1,
    status: 'unverified',
  },
];

export const MOCK_MISSING_INFO_GAPS: MissingInfoGap[] = [
  {
    id: 'GAP-101',
    title: 'Post-Discharge 14-Day Microalbuminuria Screening Missing',
    clinicalRelevance:
      'Recommended standard following inpatient glycemic excursion to establish updated urinary albumin-to-creatinine ratio (uACR).',
    suggestedAction: 'Order spot urine uACR at upcoming consultation.',
    timeframe: 'Due November 2026',
  },
  {
    id: 'GAP-102',
    title: 'Pre-2025 Transthoracic Echocardiogram (TTE) Record Missing',
    clinicalRelevance:
      'Baseline cardiac ejection fraction documentation is absent from ingested records prior to SGLT2 initiation.',
    suggestedAction: 'Request record transfer from Highland Memorial Cardiology archive.',
    timeframe: 'Historical gap (prior to 2025)',
  },
];
