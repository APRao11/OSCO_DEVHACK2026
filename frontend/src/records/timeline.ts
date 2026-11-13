import type { DocumentType, Finding, FindingCategory, PatientRecords, SourceDocument } from '../types/records';
import { isShownFinding } from './format';

/**
 * Timeline for the Medical History page (MVP document section 6.1.5).
 *
 * One entry per processed document, placed at the date written in the
 * document, never the upload date, and sorted latest first. A document whose
 * date is missing or ambiguous goes into the "Undated / needs review" group
 * instead of being guessed into a position. Family findings never appear in
 * the patient's own timeline; they are returned separately.
 */

export interface TimelineEntry {
  document: SourceDocument;
  /** ISO date written in the document, or null when undated/ambiguous */
  date: string | null;
  findings: Finding[];
  /** Why an undated entry needs review */
  reviewReason: string | null;
}

export interface TimelineFilters {
  documentType: DocumentType | 'all';
  category: FindingCategory | 'all';
}

export interface Timeline {
  dated: TimelineEntry[];
  undated: TimelineEntry[];
  familyHistory: Finding[];
}

const CATEGORY_ORDER: FindingCategory[] = ['condition', 'event', 'medication', 'allergy', 'investigation'];

const byCategoryThenPosition = (a: Finding, b: Finding) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
  a.page - b.page ||
  a.quoteStart - b.quoteStart;

const reviewReasonFor = (document: SourceDocument): string =>
  document.dateAlternatives?.length
    ? `The date "${document.documentDateText}" could be ${document.dateAlternatives.join(' or ')}.`
    : 'The document has no date.';

export const buildTimeline = (
  records: PatientRecords,
  filters: TimelineFilters = { documentType: 'all', category: 'all' },
): Timeline => {
  const dated: TimelineEntry[] = [];
  const undated: TimelineEntry[] = [];

  for (const document of records.documents) {
    if (document.status !== 'ready') continue;
    if (filters.documentType !== 'all' && document.documentType !== filters.documentType) continue;

    const findings = records.findings
      .filter((finding) => finding.documentId === document.id && isShownFinding(finding))
      .filter((finding) => filters.category === 'all' || finding.category === filters.category)
      .sort(byCategoryThenPosition);
    if (findings.length === 0) continue;

    const entry: TimelineEntry = {
      document,
      date: document.documentDate,
      findings,
      reviewReason: document.documentDate ? null : reviewReasonFor(document),
    };
    (entry.date ? dated : undated).push(entry);
  }

  dated.sort((a, b) => b.date!.localeCompare(a.date!) || a.document.name.localeCompare(b.document.name));
  undated.sort((a, b) => a.document.name.localeCompare(b.document.name));

  const familyHistory = records.findings.filter(
    (finding) => finding.subject === 'family' && finding.verificationStatus !== 'rejected' && !finding.supersededBy,
  );

  return { dated, undated, familyHistory };
};
