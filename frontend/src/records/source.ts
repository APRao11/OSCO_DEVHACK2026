import type { PatientRecords, SourceTarget } from '../types/records';

/** The Source Viewer target for one finding, or null if its document is unknown. */
export const sourceTargetFor = (records: PatientRecords, findingId: string): SourceTarget | null => {
  // Current findings first, then earlier versions a review flag still refers to.
  const finding = records.findings.find((f) => f.id === findingId) ?? records.referencedFindings?.find((f) => f.id === findingId);
  const document = finding && records.documents.find((d) => d.id === finding.documentId);
  // Doctor-entered findings have no document quote: the clinical record itself is the source.
  if (!finding || !document || !finding.quote || document.kind === 'clinical_record') return null;
  return {
    document,
    page: finding.page,
    quoteStart: finding.quoteStart,
    quoteEnd: finding.quoteEnd,
    quote: finding.quote,
  };
};
