/**
 * Document-derived records, shaped like the backend `claims` table (MVP
 * document section 7.3) and the worker's reconciliation output (section 8.6).
 */

export type FindingCategory = 'condition' | 'medication' | 'allergy' | 'investigation' | 'event';
export type Assertion = 'present' | 'absent' | 'possible' | 'historical';
export type Subject = 'patient' | 'family' | 'other';
export type MedicationAction = 'start' | 'continue' | 'change' | 'stop' | 'none';
export type DocumentType =
  | 'prescription'
  | 'lab_report'
  | 'discharge_summary'
  | 'imaging_report'
  | 'clinical_note'
  | 'other';

export interface Finding {
  id: string;
  documentId: string;
  category: FindingCategory;
  name: string;
  nameNormalised: string;
  subject: Subject;
  subjectRelation: string | null;
  assertion: Assertion;
  action: MedicationAction | null;
  dose: string | null;
  frequency: string | null;
  value: string | null;
  unit: string | null;
  refRange: string | null;
  dateText: string | null;
  /** ISO date, or YYYY-MM / YYYY for month or year precision */
  eventDate: string | null;
  datePrecision: 'day' | 'month' | 'year' | null;
  dateAlternatives: string[] | null;
  /** Verified quote, exactly as it appears in the page text */
  quote: string;
  page: number;
  /** Offsets into the stored page text, from the Quote Verifier */
  quoteStart: number;
  quoteEnd: number;
  matchType: 'exact' | 'approximate';
  sourceType: 'ai_extracted' | 'doctor_entered';
  verificationStatus: 'unverified' | 'doctor_verified' | 'corrected' | 'rejected';
  /** Set when a correction replaced this finding */
  supersededBy?: string | null;
}

export interface SourcePage {
  pageNumber: number;
  text: string;
}

export interface SourceDocument {
  id: string;
  name: string;
  fileUrl: string | null;
  documentType: DocumentType;
  /** ISO date when the document's own date is unambiguous */
  documentDate: string | null;
  documentDateText: string | null;
  dateAlternatives: string[] | null;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  pageCount: number;
  /** Stored page text, used by the Source Viewer's text fallback */
  pages: SourcePage[];
}

export interface MedicationEvidence {
  claimId: string | null;
  date: string;
  datePrecision: string | null;
  dateSource: 'event' | 'document' | null;
  action: MedicationAction;
  dose: string | null;
  frequency: string | null;
}

export interface MedicationSegment {
  dose: string | null;
  frequency: string | null;
  from: MedicationEvidence;
  to: MedicationEvidence | null;
}

export interface MedicationEpisode {
  start: MedicationEvidence | null;
  firstEvidence: MedicationEvidence;
  end: MedicationEvidence | null;
  segments: MedicationSegment[];
  evidence: MedicationEvidence[];
}

export interface MedicationHistory {
  drug: string;
  episodes: MedicationEpisode[];
  status: {
    state: 'stopped' | 'last_documented_active' | 'undated_only';
    label: string;
    date?: string;
    source?: MedicationEvidence;
    ageMonths?: number;
    possiblyOutdated?: boolean;
  };
  flags: { type: string; message: string; claimIds: (string | null)[] }[];
}

export type FlagType =
  | 'contradiction'
  | 'duplicate'
  | 'missing_field'
  | 'ambiguous_date'
  | 'orphan_reference'
  | 'stale_medication'
  | 'active_after_stop';

export interface RecordFlag {
  id: string;
  type: FlagType;
  message: string;
  findingIds: string[];
  documentIds: string[];
  status: 'open' | 'resolved';
}

export interface ExtractionStats {
  returned: number;
  accepted: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
  pageCorrections: number;
}

export interface PatientRecords {
  patientId: string;
  patientName: string;
  builtAt: string;
  extractionStats: ExtractionStats;
  documents: SourceDocument[];
  findings: Finding[];
  medicationHistories: MedicationHistory[];
  flags: RecordFlag[];
}

/** What the Source Viewer opens: one finding's evidence in one document. */
export interface SourceTarget {
  document: SourceDocument;
  page: number;
  quoteStart: number;
  quoteEnd: number;
  quote: string;
}
