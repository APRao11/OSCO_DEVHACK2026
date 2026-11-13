import type {
  PersonalHealthInfo,
  UploadedDocument,
  TimelineEvent,
  ChatMessage,
} from '../types/patient';

export const INITIAL_PERSONAL_HEALTH_INFO: PersonalHealthInfo = {
  bloodGroup: 'O-Positive (O+)',
  height: '168 cm',
  weight: '64.5 kg',
  allergies: ['Penicillin (Moderate rash / urticaria)', 'Sulfa Antibiotics (Contact dermatitis)'],
  conditions: [
    'Type 2 Diabetes Mellitus',
    'Mild Peripheral Neuropathy (Distal lower extremity)',
    'Essential Hypertension (Stage 1)',
  ],
  otherNotes:
    'Adheres to low-glycemic Mediterranean diet. Former social smoker (cessation 2019). No known family history of early coronary artery disease.',
  lastUpdated: '2026-11-04 • Patient Self-Reported',
};

export const INITIAL_DOCUMENTS: UploadedDocument[] = [
  {
    id: 'doc-001',
    name: 'Discharge_Summary_StJude_2026.pdf',
    type: 'Discharge Summary',
    fileFormat: 'PDF',
    size: '2.4 MB',
    uploadDate: '2026-11-01',
    relevantDate: '2026-10-24',
    status: 'Completed',
    facility: 'St. Jude Medical Center',
    pageCount: 4,
  },
  {
    id: 'doc-002',
    name: 'Comprehensive_Metabolic_Panel_LabCorp.pdf',
    type: 'Lab Report',
    fileFormat: 'PDF',
    size: '840 KB',
    uploadDate: '2026-10-25',
    relevantDate: '2026-10-24',
    status: 'Completed',
    facility: 'LabCorp Palo Alto',
    pageCount: 2,
  },
  {
    id: 'doc-003',
    name: 'Endocrinology_FollowUp_ProgressNote.pdf',
    type: 'Consultation Letter',
    fileFormat: 'PDF',
    size: '1.1 MB',
    uploadDate: '2026-08-16',
    relevantDate: '2026-08-14',
    status: 'Completed',
    facility: 'Bay Health Endocrine Institute',
    pageCount: 3,
  },
  {
    id: 'doc-004',
    name: 'Annual_Retinal_Screening_Report.pdf',
    type: 'Imaging Report',
    fileFormat: 'PDF',
    size: '3.8 MB',
    uploadDate: '2026-04-05',
    relevantDate: '2026-04-02',
    status: 'Completed',
    facility: 'Pacific Eye & Retina Center',
    pageCount: 5,
  },
  {
    id: 'doc-005',
    name: 'Pharmacy_Rx_Ledger_Q1_2026.pdf',
    type: 'Prescription Note',
    fileFormat: 'PDF',
    size: '520 KB',
    uploadDate: '2026-03-12',
    relevantDate: '2026-03-10',
    status: 'Completed',
    facility: 'Walgreens Surescripts',
    pageCount: 2,
  },
  {
    id: 'doc-006',
    name: 'Emergency_Admission_Record_2025.pdf',
    type: 'Hospital Admission',
    fileFormat: 'PDF',
    size: '1.9 MB',
    uploadDate: '2025-12-02',
    relevantDate: '2025-11-28',
    status: 'Completed',
    facility: 'Highland Memorial ER',
    pageCount: 3,
  },
];

export const INITIAL_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'EVT-101',
    date: '2026-10-24',
    category: 'Lab Investigation',
    title: 'Comprehensive Metabolic Panel (CMP) & Glycated Hemoglobin',
    description:
      'Laboratory investigation evaluating fasting glucose, electrolytes, kidney function, and glycated hemoglobin (HbA1c).',
    facility: 'LabCorp Diagnostic Services, Palo Alto',
    doctor: 'Dr. C. Robinson, MD (Pathology)',
    sourceDoc: 'Comprehensive_Metabolic_Panel_LabCorp.pdf',
    sourcePage: 2,
    confidence: 99.4,
    aiSummary:
      'Deterministic extraction of fasting blood glucose (124 mg/dL) and HbA1c (6.8%). Significant glycemic control improvement observed compared to 7.4% baseline in Q1 2026. Renal clearance parameters (eGFR: 88 mL/min, serum creatinine: 0.92 mg/dL) remain stable within target therapeutic threshold.',
    extractedDetails: [
      { label: 'HbA1c', value: '6.8%', code: 'LOINC 4548-4' },
      { label: 'Fasting Blood Glucose', value: '124 mg/dL', code: 'LOINC 1558-6' },
      { label: 'Estimated GFR', value: '88 mL/min/1.73m²', code: 'LOINC 33914-3' },
      { label: 'Serum Creatinine', value: '0.92 mg/dL', code: 'LOINC 2160-0' },
    ],
  },
  {
    id: 'EVT-102',
    date: '2026-10-24',
    category: 'Discharge',
    title: 'Hospital Discharge Summary — Inpatient Glycemic Stabilization',
    description:
      'Discharge following 24-hour observation period after transient post-prandial glycemic spike.',
    facility: 'St. Jude Medical Center, Internal Medicine',
    doctor: 'Dr. Katherine Miller, MD',
    sourceDoc: 'Discharge_Summary_StJude_2026.pdf',
    sourcePage: 1,
    confidence: 98.9,
    aiSummary:
      'Patient discharged in stable hemodynamic condition following brief observation for transient post-prandial hyperglycemia. Hydration restored. Confirmed outpatient follow-up cadence with endocrinologist Dr. Chen.',
    extractedDetails: [
      { label: 'Length of Stay', value: '24 Hours' },
      { label: 'Discharge Disposition', value: 'Home with Routine Outpatient Monitoring' },
      { label: 'Discharge Vitals', value: 'BP 122/78 mmHg, HR 72 bpm, SpO2 99%' },
    ],
  },
  {
    id: 'EVT-103',
    date: '2026-08-14',
    category: 'Medication Change',
    title: 'Pharmacotherapy Titration: Initiation of SGLT2 Inhibitor',
    description:
      'Cardiometabolic regimen adjustment. Initiated Empagliflozin 10mg daily for dual glycemic control and cardiorenal protection.',
    facility: 'Bay Health Endocrine Institute',
    doctor: 'Dr. Alistair Chen, MD (Endocrinology)',
    sourceDoc: 'Endocrinology_FollowUp_ProgressNote.pdf',
    sourcePage: 3,
    confidence: 98.2,
    aiSummary:
      'Physician added Empagliflozin (Jardiance) 10mg once daily to complement ongoing Metformin ER. Target HbA1c adjusted to <7.0%. Patient counselled on adequate daily fluid intake and signs of euglycemic DKA.',
    extractedDetails: [
      { label: 'Prescribing Physician', value: 'Dr. Alistair Chen, MD (Endocrinology)' },
      { label: 'Therapeutic Goal', value: 'Glycemic variability stabilization + cardiorenal benefit' },
      { label: 'RxNorm Concept', value: 'Empagliflozin 10 MG Oral Tablet (RxCUI 1545653)' },
    ],
    medicationDetails: {
      name: 'Empagliflozin (Jardiance)',
      dosage: '10 mg Oral Tablet Once Daily',
      status: 'Started',
      reason: 'Cardiorenal risk reduction and secondary glycemic control',
      isCurrentlyActive: true,
      prescribingDoctor: 'Dr. Alistair Chen, MD',
    },
  },
  {
    id: 'EVT-104',
    date: '2026-08-14',
    category: 'Medication Change',
    title: 'Discontinuation of Sulfonylurea (Glipizide)',
    description:
      'Clinical cessation of Glipizide ER due to recurrent nocturnal hypoglycemia episodes.',
    facility: 'Bay Health Endocrine Institute',
    doctor: 'Dr. Alistair Chen, MD (Endocrinology)',
    sourceDoc: 'Endocrinology_FollowUp_ProgressNote.pdf',
    sourcePage: 4,
    confidence: 97.8,
    aiSummary:
      'Glipizide 5mg daily was permanently discontinued following patient logs indicating 3 nocturnal hypoglycemia readings between 54–62 mg/dL. Replaced by SGLT2 inhibitor. Patient confirmed no further sulfonylurea use.',
    extractedDetails: [
      { label: 'Cessation Protocol', value: 'Immediate complete discontinuation' },
      { label: 'Clinical Rationale', value: 'Recurrent mild nocturnal hypoglycemia (54-62 mg/dL)' },
      { label: 'Status Notice', value: 'Patient is NOT taking this medication' },
    ],
    medicationDetails: {
      name: 'Glipizide ER',
      dosage: '5 mg Oral Tablet Daily',
      status: 'Discontinued',
      reason: 'Recurrent mild nocturnal hypoglycemia',
      isCurrentlyActive: false,
      prescribingDoctor: 'Dr. Alistair Chen, MD',
    },
  },
  {
    id: 'EVT-105',
    date: '2026-04-02',
    category: 'Imaging Report',
    title: 'Digital Fundus Photography & Dilated Retinal Exam',
    description:
      'Annual diabetic retinopathy screening to evaluate retinal microvasculature.',
    facility: 'Pacific Eye & Retina Center',
    doctor: 'Dr. Rachel Vance, OD',
    sourceDoc: 'Annual_Retinal_Screening_Report.pdf',
    sourcePage: 1,
    confidence: 99.1,
    aiSummary:
      'Bilateral fundus photography under pharmacologic mydriasis. No microaneurysms, cotton wool spots, or macular edema detected. Optic disc margins sharp bilaterally. Annual screening cadence confirmed for April 2027.',
    extractedDetails: [
      { label: 'Diagnostic ICD-10', value: 'Z13.89 (Encounter for screening for endocrine disorder)' },
      { label: 'Right Eye (OD)', value: 'No diabetic retinopathy detected' },
      { label: 'Left Eye (OS)', value: 'No diabetic retinopathy detected' },
      { label: 'Next Screening Due', value: 'April 2027' },
    ],
  },
  {
    id: 'EVT-106',
    date: '2026-03-10',
    category: 'Prescription',
    title: 'Outpatient Medication Renewal: Metformin Extended Release',
    description:
      'Routine 90-day maintenance prescription refill for primary insulin sensitization.',
    facility: 'Bay Health Primary Care Clinic',
    doctor: 'Dr. Marcus Webb, MD',
    sourceDoc: 'Pharmacy_Rx_Ledger_Q1_2026.pdf',
    sourcePage: 1,
    confidence: 98.7,
    aiSummary:
      'Electronic refill authorization sent to Walgreens. Metformin ER 1000mg BID continued without dosage modification. Patient reports consistent adherence with evening meal.',
    extractedDetails: [
      { label: 'Dispensing Pharmacy', value: 'Walgreens Pharmacy #04128, Palo Alto' },
      { label: 'Prescription Quantity', value: '180 Tablets (90-day supply)' },
      { label: 'Refills Remaining', value: '3 Refills' },
    ],
    medicationDetails: {
      name: 'Metformin Hydrochloride ER',
      dosage: '1000 mg Oral Tablet Twice Daily with Meals',
      status: 'Started',
      isCurrentlyActive: true,
      prescribingDoctor: 'Dr. Marcus Webb, MD',
    },
  },
  {
    id: 'EVT-107',
    date: '2025-11-28',
    category: 'Hospital Admission',
    title: 'Emergency Department Evaluation — Dizziness & Hyperglycemia',
    description:
      'Urgent encounter for post-viral dehydration and blood glucose excursion.',
    facility: 'Highland Memorial Hospital',
    doctor: 'Dr. Gregory House, MD (Emergency Medicine)',
    sourceDoc: 'Emergency_Admission_Record_2025.pdf',
    sourcePage: 1,
    confidence: 97.4,
    aiSummary:
      'Patient self-presented with orthostatic lightheadedness following 3 days of viral gastroenteritis. Random capillary glucose measured 268 mg/dL. 2 liters Normal Saline IV administered with symptom resolution.',
    extractedDetails: [
      { label: 'Triage Acuity', value: 'ESI Level 3 (Urgent)' },
      { label: 'Initial Blood Glucose', value: '268 mg/dL' },
      { label: 'IV Hydration', value: '2000 mL 0.9% Normal Saline' },
      { label: 'Discharge Glucose', value: '142 mg/dL' },
    ],
  },
  {
    id: 'EVT-108',
    date: '2025-06-15',
    category: 'Diagnosis',
    title: 'Initial Clinical Diagnosis: Type 2 Diabetes Mellitus',
    description:
      'First documented diagnosis of Type 2 Diabetes following abnormal repeat fasting blood draws.',
    facility: 'Bay Health Primary Care Clinic',
    doctor: 'Dr. Marcus Webb, MD',
    sourceDoc: 'Endocrinology_FollowUp_ProgressNote.pdf',
    sourcePage: 1,
    confidence: 99.0,
    aiSummary:
      'Formal diagnosis established following repeat fasting plasma glucose of 144 mg/dL and baseline HbA1c of 7.8%. Structured diabetic education and home glucometer training ordered.',
    extractedDetails: [
      { label: 'ICD-10 Code', value: 'E11.9 (Type 2 diabetes mellitus without complications)' },
      { label: 'Baseline HbA1c', value: '7.8%' },
      { label: 'Initial Regimen', value: 'Lifestyle intervention + Metformin ER 500mg daily' },
    ],
  },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'assistant',
    text: 'Hello Elena. I am your OSCO Health Assistant. I retrieve answers exclusively from your verified medical records, diagnostic tests, and doctor notes. I cannot diagnose conditions or prescribe medications. How can I help you review your medical history today?',
    timestamp: '10:00 AM',
  },
  {
    id: 'msg-2',
    sender: 'user',
    text: 'What medications were prescribed to me, and which ones am I currently taking?',
    timestamp: '10:02 AM',
  },
  {
    id: 'msg-3',
    sender: 'assistant',
    text: 'Based on your latest verified clinical records, here is your current medication status:\n\n**Currently Active Medications:**\n1. **Metformin Hydrochloride ER** — 1000 mg Oral Tablet Twice Daily with Meals (Prescribed by Dr. Marcus Webb, renewed March 10, 2026).\n2. **Empagliflozin (Jardiance)** — 10 mg Oral Tablet Once Daily (Started by Dr. Alistair Chen on August 14, 2026 for cardiorenal protection and glycemic control).\n\n**Discontinued Medications:**\n- **Glipizide ER** (5 mg daily) — **Discontinued** on August 14, 2026 by Dr. Chen due to recurrent mild nocturnal hypoglycemia. You should no longer be taking this medication.',
    timestamp: '10:02 AM',
    sources: [
      {
        docName: 'Endocrinology_FollowUp_ProgressNote.pdf',
        page: 3,
        date: '2026-08-14',
        excerpt:
          'Initiate Empagliflozin 10mg once daily. Discontinue Glipizide ER 5mg daily immediately due to recurrent nocturnal hypoglycemia.',
      },
      {
        docName: 'Pharmacy_Rx_Ledger_Q1_2026.pdf',
        page: 1,
        date: '2026-03-10',
        excerpt:
          'Metformin ER 1000mg oral tablet BID, 180 tablets dispensed with 3 refills.',
      },
    ],
  },
];
