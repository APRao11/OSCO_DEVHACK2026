import type { Finding, MedicationHistory, PatientRecords, RecordFlag, SourceDocument } from '../types/records';
import {
  findingDate,
  findingDetail,
  formatRecordDate,
  isShownFinding,
  pluralDocuments,
  provenanceLabel,
  type ProvenanceLabel,
} from './format';

/**
 * Emergency Brief (MVP document sections 6.2.4 and 7.5).
 *
 * Six cards, each built by a fixed query over verified findings, medication
 * histories and flags. No LLM is involved, so nothing can be invented, merged
 * or quietly dropped, and the same records always give the same brief.
 * Every line carries its date, a source and a provenance label. Every card
 * has an explicit empty state that says what "empty" does and does not mean.
 */

export interface BriefLine {
  key: string;
  title: string;
  detail: string | null;
  /** Display date, e.g. "12 Mar 2019" or "Date unclear" */
  date: string;
  /** Finding to open in the Source Viewer; null for computed lines (e.g. empty categories) */
  sourceFindingId: string | null;
  label: ProvenanceLabel | 'Computed from records' | null;
  tags: string[];
}

export interface ContradictionLine {
  key: string;
  message: string;
  versions: BriefLine[];
}

export interface BriefCard<T = BriefLine> {
  id: 'allergies' | 'medications' | 'events' | 'investigations' | 'contradictions' | 'missing';
  title: string;
  lines: T[];
  /** Shown (and only shown) when lines is empty */
  emptyMessage: string;
  /** Secondary list, e.g. "documented as absent" allergy statements */
  secondary?: { heading: string; lines: BriefLine[] };
  /** e.g. "Showing the latest 10 of 14" */
  note?: string;
}

export interface EmergencyBriefData {
  builtAt: string;
  documentsReviewed: number;
  allergies: BriefCard;
  medications: BriefCard;
  events: BriefCard;
  investigations: BriefCard;
  contradictions: BriefCard<ContradictionLine>;
  missing: BriefCard;
}

export interface BriefOptions {
  /** Date the brief is built for; defaults to records.builtAt so the output is reproducible */
  asOf?: string;
  /** Section 7.5: "latest result per test in the last 12 months (configurable)" */
  recentMonths?: number;
  /** Section 7.5: major events "capped at 10" */
  maxEvents?: number;
}

const monthsBetween = (fromIso: string, toIso: string): number => {
  const [fy, fm = 1, fd = 1] = fromIso.split('-').map(Number);
  const [ty, tm = 1, td = 1] = toIso.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
};

export const buildEmergencyBrief = (records: PatientRecords, options: BriefOptions = {}): EmergencyBriefData => {
  const asOf = options.asOf ?? records.builtAt;
  const recentMonths = options.recentMonths ?? 12;
  const maxEvents = options.maxEvents ?? 10;

  const documents = new Map(records.documents.map((document) => [document.id, document]));
  const reviewed = records.documents.filter((document) => document.status === 'ready');
  const n = reviewed.length;
  const inDocs = `in the ${pluralDocuments(n)} reviewed`;
  // With nothing processed, "nothing found" would read as "checked and clear", so say so plainly.
  const noDocuments = (what: string) =>
    `No documents have been processed yet, so nothing about ${what} can be established from records.`;

  // Rejected, superseded and relatives' findings never appear (section 7.5).
  const findings = records.findings.filter(isShownFinding);
  const findingsById = new Map(records.findings.map((finding) => [finding.id, finding]));

  const lineFor = (finding: Finding, overrides: Partial<BriefLine> = {}): BriefLine => {
    const document: SourceDocument | undefined = documents.get(finding.documentId);
    const { date } = findingDate(finding, document);
    return {
      key: finding.id,
      title: finding.name,
      detail: findingDetail(finding) || null,
      date: date ? formatRecordDate(date) : 'Date unclear',
      sourceFindingId: finding.id,
      label: provenanceLabel(finding),
      tags: [],
      ...overrides,
    };
  };

  const sortKey = (finding: Finding) => findingDate(finding, documents.get(finding.documentId)).date ?? '';
  const latestFirst = (a: Finding, b: Finding) => sortKey(b).localeCompare(sortKey(a));

  // ---------------------------------------------------------------- 1 Allergies
  // Group by normalised allergen; general "no known allergies" statements listed separately.
  const allergyFindings = findings.filter((finding) => finding.category === 'allergy');
  const allergenGroups = new Map<string, Finding[]>();
  for (const finding of allergyFindings.filter((f) => f.assertion === 'present' || f.assertion === 'possible')) {
    const group = allergenGroups.get(finding.nameNormalised) ?? [];
    group.push(finding);
    allergenGroups.set(finding.nameNormalised, group);
  }
  const allergyLines = [...allergenGroups.values()].map((group) => {
    const [latest] = [...group].sort(latestFirst);
    const confirmed = group.some((f) => f.assertion === 'present');
    return lineFor(latest, {
      detail: `Documented as: "${latest.quote}"`,
      tags: [
        ...(confirmed ? [] : ['Possible - unconfirmed']),
        ...(group.length > 1 ? [`${group.length} sources`] : []),
      ],
    });
  });
  const absentAllergyLines = allergyFindings
    .filter((finding) => finding.assertion === 'absent')
    .sort(latestFirst)
    .map((finding) => lineFor(finding, { detail: `"${finding.quote}"`, tags: ['Documented as absent'] }));

  const allergies: BriefCard = {
    id: 'allergies',
    title: 'Allergies',
    lines: allergyLines,
    emptyMessage: n === 0
      ? `${noDocuments('allergies')} This does not mean the patient has none.`
      : absentAllergyLines.length
      ? `No allergy is documented as present ${inDocs}. A "no known allergies" statement is listed below; it does not cover every substance.`
      : `No allergy is documented ${inDocs}. This does not mean the patient has none.`,
    secondary: absentAllergyLines.length ? { heading: 'Documented as absent', lines: absentAllergyLines } : undefined,
  };

  // ---------------------------------------------------------- 2 Medication History
  // One line per drug from reconciliation: start, dose changes, stop.
  const writtenNames = (drug: string) => {
    const names = new Set(
      findings.filter((f) => f.category === 'medication' && f.nameNormalised === drug).map((f) => f.name),
    );
    return [...names];
  };
  const medicationLine = (history: MedicationHistory): BriefLine => {
    const steps: string[] = [];
    for (const episode of history.episodes) {
      episode.segments.forEach((segment, index) => {
        const what = [segment.dose ?? 'dose not documented', segment.frequency].filter(Boolean).join(' ');
        const verb = index === 0 ? (episode.start ? 'Started' : 'First documented') : 'Dose changed to';
        steps.push(`${verb} ${formatRecordDate(segment.from.date)}: ${what}`);
      });
    }
    const status = history.status;
    const statusText =
      status.state === 'stopped'
        ? `Stopped on ${formatRecordDate(status.date)}`
        : status.state === 'last_documented_active'
          ? `Last documented active on ${formatRecordDate(status.date)}; no later record found`
          : 'Mentioned without a date';
    const names = writtenNames(history.drug).filter((name) => name.toLowerCase() !== history.drug);
    const sourceId = status.source?.claimId ?? null;
    const source = sourceId ? findingsById.get(sourceId) : undefined;
    return {
      key: `med-${history.drug}`,
      title: history.drug.charAt(0).toUpperCase() + history.drug.slice(1) + (names.length ? ` (written as ${names.join(', ')})` : ''),
      detail: [...steps, statusText].join(' · '),
      date: status.date ? formatRecordDate(status.date) : 'Date unclear',
      sourceFindingId: sourceId,
      label: source ? provenanceLabel(source) : null,
      tags: [
        ...(status.possiblyOutdated ? ['May be outdated'] : []),
        ...(history.flags.some((flag) => flag.type === 'active_after_stop') ? ['Possible restart or conflicting records'] : []),
      ],
    };
  };
  const medications: BriefCard = {
    id: 'medications',
    title: 'Medication History',
    lines: [...records.medicationHistories]
      .sort((a, b) => (b.status.date ?? '').localeCompare(a.status.date ?? '') || a.drug.localeCompare(b.drug))
      .map(medicationLine),
    emptyMessage: n === 0
      ? `${noDocuments('medicines')} This does not mean the patient takes none.`
      : `No medicine is documented ${inDocs}. This does not mean the patient takes none.`,
  };

  // ------------------------------------------------------- 3 Major Medical Events
  // Admissions, procedures and conditions stated as present, historical or possible. Latest first, capped.
  const eventFindings = findings
    .filter((f) => (f.category === 'event' || f.category === 'condition') && f.assertion !== 'absent')
    .sort(latestFirst);
  const events: BriefCard = {
    id: 'events',
    title: 'Major Medical Events',
    lines: eventFindings.slice(0, maxEvents).map((finding) =>
      lineFor(finding, {
        detail: `"${finding.quote}"`,
        tags: finding.assertion === 'possible' ? ['Possible - unconfirmed'] : finding.assertion === 'historical' ? ['Past history'] : [],
      }),
    ),
    emptyMessage: n === 0 ? noDocuments('diagnoses, admissions or other major events') : `No diagnosis, admission or other major event is documented ${inDocs}.`,
    note: eventFindings.length > maxEvents ? `Showing the latest ${maxEvents} of ${eventFindings.length}. See the full timeline for the rest.` : undefined,
  };

  // ----------------------------------------------------- 4 Recent Investigations
  // Latest result per test; results older than the window are marked as older. No normal/abnormal labels.
  const testGroups = new Map<string, Finding[]>();
  for (const finding of findings.filter((f) => f.category === 'investigation' && f.assertion !== 'absent')) {
    const group = testGroups.get(finding.nameNormalised) ?? [];
    group.push(finding);
    testGroups.set(finding.nameNormalised, group);
  }
  const investigationLines = [...testGroups.values()]
    .map((group) => [...group].sort(latestFirst)[0])
    .sort(latestFirst)
    .map((latest) => {
      const date = sortKey(latest);
      const tags = !date
        ? ['Date unclear']
        : monthsBetween(date, asOf) >= recentMonths
          ? [`Older than ${recentMonths} months`]
          : [];
      return lineFor(latest, { tags });
    });
  const investigations: BriefCard = {
    id: 'investigations',
    title: 'Recent Investigations',
    lines: investigationLines,
    emptyMessage: n === 0 ? noDocuments('investigations') : `No laboratory or imaging result is documented ${inDocs}.`,
  };

  // --------------------------------------------------- 5 Unresolved Contradictions
  // Both versions side by side with their sources, until a doctor resolves them.
  const openFlags = records.flags.filter((flag) => flag.status === 'open');
  const conflictFlags = openFlags.filter((flag) => ['contradiction', 'duplicate', 'active_after_stop'].includes(flag.type));
  const contradictions: BriefCard<ContradictionLine> = {
    id: 'contradictions',
    title: 'Unresolved Contradictions',
    lines: conflictFlags.map((flag: RecordFlag) => ({
      key: flag.id,
      message: flag.message,
      versions: flag.findingIds
        .map((id) => findingsById.get(id))
        .filter((finding): finding is Finding => Boolean(finding))
        .map((finding) => lineFor(finding, { detail: `"${finding.quote}"` })),
    })),
    emptyMessage: n === 0 ? noDocuments('disagreements between records') : `No disagreement was found between the ${pluralDocuments(n)} reviewed.`,
  };

  // ------------------------------------------------------- 6 Missing Information
  // Gap flags, plus categories with no findings at all.
  const gapFlags = openFlags.filter((flag) =>
    ['missing_field', 'ambiguous_date', 'orphan_reference', 'stale_medication'].includes(flag.type),
  );
  const gapLines: BriefLine[] = gapFlags.map((flag) => {
    const first = flag.findingIds.map((id) => findingsById.get(id)).find(Boolean);
    return {
      key: flag.id,
      title: flag.message,
      detail: null,
      date: first ? lineFor(first).date : 'Date unclear',
      sourceFindingId: first?.id ?? null,
      label: 'Computed from records',
      tags: [flag.type.replace(/_/g, ' ')],
    };
  });
  const emptyCategories: [Finding['category'], string][] = [
    ['allergy', 'allergy'],
    ['medication', 'medicine'],
    ['condition', 'diagnosis or condition'],
    ['investigation', 'laboratory or imaging result'],
  ];
  for (const [category, noun] of emptyCategories) {
    if (n > 0 && !findings.some((f) => f.category === category)) {
      gapLines.push({
        key: `empty-${category}`,
        title: `No ${noun} is documented in any of the ${pluralDocuments(n)}.`,
        detail: 'This means it was not recorded, not that it does not exist.',
        date: '-',
        sourceFindingId: null,
        label: 'Computed from records',
        tags: ['empty category'],
      });
    }
  }
  const missing: BriefCard = {
    id: 'missing',
    title: 'Missing Information',
    lines: gapLines,
    emptyMessage: n === 0
      ? 'No documents have been processed yet. The whole history is missing until documents are uploaded and verified.'
      : `No gap was found ${inDocs}. This does not mean the record is complete.`,
  };

  return { builtAt: records.builtAt, documentsReviewed: n, allergies, medications, events, investigations, contradictions, missing };
};
