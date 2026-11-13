import type { Assertion, DocumentType, Finding, FindingCategory, SourceDocument } from '../types/records';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  prescription: 'Prescription',
  lab_report: 'Laboratory report',
  discharge_summary: 'Discharge summary',
  imaging_report: 'Imaging report',
  clinical_note: 'Consultation note',
  other: 'Other document',
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  medication: 'Medicines',
  condition: 'Conditions',
  allergy: 'Allergies',
  investigation: 'Investigations',
  event: 'Events',
};

/** How each qualifier is shown (section 6.1.5). `present` needs no label. */
export const ASSERTION_LABELS: Record<Assertion, string | null> = {
  present: null,
  absent: 'Documented as absent',
  possible: 'Possible - unconfirmed',
  historical: 'Past history',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format an ISO date at the precision it was documented with:
 * 2019-03-12 -> "12 Mar 2019", 2019-03 -> "Mar 2019", 2019 -> "2019".
 * Parsed by hand so time zones can never shift the day.
 */
export const formatRecordDate = (iso: string | null | undefined): string => {
  if (!iso) return 'Date not documented';
  const [year, month, day] = iso.split('-');
  if (!month) return year;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return day ? `${day} ${monthName} ${year}` : `${monthName} ${year}`;
};

/** The source label every brief line carries (section 6.2.4). */
export type ProvenanceLabel = 'Doctor-verified' | 'Doctor-entered' | 'Edited by patient' | 'AI-extracted';

export const provenanceLabel = (finding: Finding): ProvenanceLabel => {
  if (finding.sourceType === 'patient_corrected') return 'Edited by patient';
  if (finding.verificationStatus === 'doctor_verified') return 'Doctor-verified';
  if (finding.sourceType === 'doctor_entered') return 'Doctor-entered';
  return 'AI-extracted';
};

/** Findings that may be shown: the patient's own, not rejected, not replaced by a correction. */
export const isShownFinding = (finding: Finding): boolean =>
  finding.subject === 'patient' && finding.verificationStatus !== 'rejected' && !finding.supersededBy;

/** The date a finding is placed at: its own event date, else its document's date. */
export const findingDate = (
  finding: Finding,
  document: SourceDocument | undefined,
): { date: string | null; fromDocument: boolean } => {
  if (finding.eventDate) return { date: finding.eventDate, fromDocument: false };
  return { date: document?.documentDate ?? null, fromDocument: true };
};

/** "500 mg twice daily", "7.1 % (lab range 4.0 - 5.6)" - values exactly as written. */
export const findingDetail = (finding: Finding): string => {
  const parts: string[] = [];
  if (finding.category === 'medication') {
    if (finding.dose) parts.push(finding.dose);
    if (finding.frequency) parts.push(finding.frequency);
  } else if (finding.value) {
    parts.push([finding.value, finding.unit].filter(Boolean).join(' '));
    if (finding.refRange) parts.push(`(lab's range ${finding.refRange})`);
  }
  return parts.join(' ');
};

const ACTION_LABELS: Record<string, string> = {
  start: 'Started',
  change: 'Dose changed',
  stop: 'Stopped',
  continue: 'Continued',
};

export const medicationActionLabel = (action: string | null): string | null =>
  action ? ACTION_LABELS[action] ?? null : null;

export const pluralDocuments = (n: number): string => `${n} document${n === 1 ? '' : 's'}`;
