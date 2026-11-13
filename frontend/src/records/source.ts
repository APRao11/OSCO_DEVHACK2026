import type { PatientRecords, SourceTarget } from '../types/records';

/** The Source Viewer target for one finding, or null if its document is unknown. */
export const sourceTargetFor = (records: PatientRecords, findingId: string): SourceTarget | null => {
  const finding = records.findings.find((f) => f.id === findingId);
  const document = finding && records.documents.find((d) => d.id === finding.documentId);
  if (!finding || !document) return null;
  return {
    document,
    page: finding.page,
    quoteStart: finding.quoteStart,
    quoteEnd: finding.quoteEnd,
    quote: finding.quote,
  };
};
