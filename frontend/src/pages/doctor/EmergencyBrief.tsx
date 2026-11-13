import React, { useMemo } from 'react';
import { Activity, AlertTriangle, FileSearch, FileText, HelpCircle, Pill, ShieldAlert } from 'lucide-react';
import type { PatientContext } from '../../types/navigation';
import type { PatientRecords } from '../../types/records';
import { buildEmergencyBrief, type BriefCard, type BriefLine, type ContradictionLine } from '../../records/emergencyBrief';
import { formatRecordDate, pluralDocuments } from '../../records/format';

export interface EmergencyBriefProps {
  patient: PatientContext;
  records: PatientRecords;
  /** Open the Source Viewer at this finding's highlighted quote */
  onOpenSource: (findingId: string) => void;
  onOpenTimeline: () => void;
  onNavigateReview: () => void;
}

type Tone = 'warning' | 'forest';

const CardShell: React.FC<{
  number: string;
  title: string;
  icon: React.ReactNode;
  tone?: Tone;
  className: string;
  children: React.ReactNode;
}> = ({ number, title, icon, tone = 'forest', className, children }) => (
  <section className={`p-5 sm:p-6 ${className}`} aria-label={title}>
    <div className="mb-4 flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${tone === 'warning' ? 'bg-warning-subtle text-warning' : 'bg-eucalyptus-subtle text-forest'}`}>
        {icon}
      </span>
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">{number}</span>
        <h2 className={`text-xl leading-tight ${tone === 'warning' ? 'text-warning' : 'text-forest'}`}>{title}</h2>
      </div>
    </div>
    {children}
  </section>
);

/** Explicit empty state: says what an empty card does and does not mean (6.2.4). */
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <p className="border-l-2 border-border-medium pl-3 text-sm leading-6 text-text-secondary">{message}</p>
);

const LABEL_STYLES: Record<string, string> = {
  'AI-extracted': 'text-eucalyptus-dark',
  'Doctor-verified': 'text-forest font-semibold',
  'Doctor-entered': 'text-forest',
  'Computed from records': 'text-text-muted',
};

const Line: React.FC<{ line: BriefLine; onOpenSource: (id: string) => void }> = ({ line, onOpenSource }) => (
  <li className="py-3 first:pt-0 last:pb-0">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium leading-snug text-text-main">{line.title}</span>
      <time className="shrink-0 font-mono text-[10px] text-text-muted">{line.date}</time>
    </div>
    {line.detail && <p className="mt-1 text-xs leading-5 text-text-secondary">{line.detail}</p>}
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
      {line.tags.map((tag) => (
        <span key={tag} className={`rounded px-1.5 py-0.5 ${/outdated|older|unclear|conflict|unconfirmed/i.test(tag) ? 'bg-warning-subtle text-warning' : 'bg-osco-bg text-text-secondary'}`}>
          {tag}
        </span>
      ))}
      {line.label && <span className={LABEL_STYLES[line.label]}>{line.label}</span>}
      {line.sourceFindingId && (
        <button type="button" onClick={() => onOpenSource(line.sourceFindingId!)} className="inline-flex items-center gap-1 text-forest hover:underline">
          <FileText size={11} /> Source
        </button>
      )}
    </div>
  </li>
);

const Lines: React.FC<{ card: BriefCard; onOpenSource: (id: string) => void; divider: string }> = ({ card, onOpenSource, divider }) => (
  <>
    {card.lines.length ? (
      <ul className={`divide-y ${divider}`}>
        {card.lines.map((line) => (
          <Line key={line.key} line={line} onOpenSource={onOpenSource} />
        ))}
      </ul>
    ) : (
      <EmptyState message={card.emptyMessage} />
    )}
    {card.secondary && (
      <div className="mt-4 border-t border-dashed border-border-medium pt-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">{card.secondary.heading}</p>
        <ul className={`divide-y ${divider}`}>
          {card.secondary.lines.map((line) => (
            <Line key={line.key} line={line} onOpenSource={onOpenSource} />
          ))}
        </ul>
      </div>
    )}
    {card.note && <p className="mt-3 text-xs text-text-secondary">{card.note}</p>}
  </>
);

const Contradiction: React.FC<{ item: ContradictionLine; onOpenSource: (id: string) => void }> = ({ item, onOpenSource }) => (
  <li className="py-3 first:pt-0 last:pb-0">
    <p className="text-sm font-medium leading-snug text-text-main">{item.message}</p>
    {/* Both versions side by side, each with its source. Never resolved automatically. */}
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {item.versions.map((version, index) => (
        <div key={version.key} className="border-l-2 border-warning/50 bg-white/70 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">Version {String.fromCharCode(65 + index)}</p>
          <ul>
            <Line line={version} onOpenSource={onOpenSource} />
          </ul>
        </div>
      ))}
    </div>
  </li>
);

/**
 * Emergency Brief (MVP document section 6.2.4): six cards built by fixed
 * queries over verified findings (records/emergencyBrief.ts), not by an LLM.
 * A summary, not a replacement for the full history.
 */
export const EmergencyBrief: React.FC<EmergencyBriefProps> = ({ patient, records, onOpenSource, onOpenTimeline, onNavigateReview }) => {
  const brief = useMemo(() => buildEmergencyBrief(records), [records]);

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-col gap-3 border-b border-[#D5DDD6] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-eucalyptus-dark">Patient record</p>
          <h1 className="mt-1 text-4xl leading-none text-forest sm:text-5xl">Emergency Brief</h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-text-secondary">
            Built from verified document findings by fixed rules, not written by AI. A summary, not a replacement for the{' '}
            <button type="button" onClick={onOpenTimeline} className="text-forest underline-offset-2 hover:underline">
              full timeline
            </button>
            .
          </p>
        </div>
        <div className="font-mono text-xs text-text-secondary sm:text-right">
          <p className="font-sans text-sm font-medium text-text-main">{patient.name}</p>
          <p>Patient ID · {patient.id}</p>
          <p className="mt-1">
            Built {formatRecordDate(brief.builtAt)} · based on {pluralDocuments(brief.documentsReviewed)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-px border border-[#D5DDD6] bg-[#D5DDD6] lg:grid-cols-12">
        <CardShell number="01" title="Allergies" icon={<ShieldAlert size={16} />} tone="warning" className="bg-[#FBF7F1] lg:col-span-4">
          <Lines card={brief.allergies} onOpenSource={onOpenSource} divider="divide-[#E8D8D1]" />
        </CardShell>

        <CardShell number="02" title="Medication History" icon={<Pill size={16} />} className="bg-[#F7F8F3] lg:col-span-8">
          <Lines card={brief.medications} onOpenSource={onOpenSource} divider="divide-[#DCE3DD]" />
        </CardShell>

        <CardShell number="03" title="Major Medical Events" icon={<Activity size={16} />} className="bg-[#F8F8F3] lg:col-span-7">
          <Lines card={brief.events} onOpenSource={onOpenSource} divider="divide-[#DCE3DD]" />
        </CardShell>

        <CardShell number="04" title="Recent Investigations" icon={<FileSearch size={16} />} className="bg-[#F0F5F1] lg:col-span-5">
          <Lines card={brief.investigations} onOpenSource={onOpenSource} divider="divide-[#D7E1DB]" />
          {brief.investigations.lines.length > 0 && (
            <p className="mt-3 text-[11px] text-text-muted">Values and units as written, with each laboratory's own range. No normal or abnormal labels are added.</p>
          )}
        </CardShell>

        <CardShell number="05" title="Unresolved Contradictions" icon={<AlertTriangle size={16} />} tone="warning" className="bg-[#FBF3EF] lg:col-span-6">
          {brief.contradictions.lines.length ? (
            <>
              <ul className="divide-y divide-[#E8D8D1]">
                {brief.contradictions.lines.map((item) => (
                  <Contradiction key={item.key} item={item} onOpenSource={onOpenSource} />
                ))}
              </ul>
              <button type="button" onClick={onNavigateReview} className="mt-4 font-mono text-[10px] font-medium uppercase tracking-wide text-warning hover:underline">
                Open review workspace
              </button>
            </>
          ) : (
            <EmptyState message={brief.contradictions.emptyMessage} />
          )}
        </CardShell>

        <CardShell number="06" title="Missing Information" icon={<HelpCircle size={16} />} className="bg-[#F5F6F1] lg:col-span-6">
          <Lines card={brief.missing} onOpenSource={onOpenSource} divider="divide-[#DCE3DD]" />
        </CardShell>
      </div>
    </div>
  );
};
