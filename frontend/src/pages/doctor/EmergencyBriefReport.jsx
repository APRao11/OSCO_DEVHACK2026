import {
  Activity,
  BedDouble,
  CalendarX2,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Pill,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';
import { BRIEF } from '../../data/emergencyBrief.mock';
import { BriefCard } from '../../components/brief/BriefCard';
import { BigStat } from '../../components/brief/BigStat';
import { ProvenanceTag } from '../../components/brief/ProvenanceTag';
import { SourceChip } from '../../components/brief/SourceChip';
import { MedRibbon, RibbonAxis } from '../../components/brief/MedRibbon';
import { DotMatrix } from '../../components/brief/DotMatrix';

const EVENT_ICONS = { visit: Stethoscope, imaging: HeartPulse, diagnosis: ClipboardList, admission: BedDouble };

const TAG_TONES = {
  brick: 'bg-brick-soft text-brick',
  ochre: 'bg-ochre-soft text-[#7A5A16]',
};

function Tag({ tone, children, onDark = false }) {
  const style = onDark ? (tone === 'brick' ? 'bg-brick text-white' : 'bg-ochre text-aubergine') : TAG_TONES[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-inter text-[10.5px] font-semibold ${style}`}>{children}</span>;
}

function SubHeading({ children }) {
  return <p className="mb-2 mt-4 font-inter text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted first:mt-0">{children}</p>;
}

/**
 * Doctor's Emergency Brief: main content area only (MVP document 6.2.4).
 * Recorded facts with their provenance and source; no diagnosis or advice.
 * Data comes from src/data/emergencyBrief.mock.js.
 *
 * @param {{ data?: typeof BRIEF, onOpenTimeline?: () => void, onOpenSource?: (source) => void, onReview?: (conflict) => void }} props
 */
export function EmergencyBriefReport({ data = BRIEF, onOpenTimeline, onOpenSource, onReview }) {
  const { patient, medications, allergies, investigations, missing, conflicts, events } = data;
  const noStopRecorded = medications.filter((m) => !m.stopped).length;
  // Contradictions whose sides include a conflicting allergy statement.
  const conflictingAllergySources = new Set(
    [...allergies.documented, ...allergies.documentedAbsent].filter((a) => a.conflict).map((a) => a.source.id),
  );
  const allergyConflicts = conflicts.filter(
    (c) => c.kind === 'contradiction' && c.sides.some((side) => conflictingAllergySources.has(side.source.id)),
  ).length;
  const review = onReview ?? ((conflict) => console.log('[EmergencyBrief] review', conflict.id));

  return (
    <div className="brief-fade-in rounded-[28px] bg-bone p-4 font-inter text-aubergine sm:p-6 lg:p-8">
      {/* Page header */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-fraunces text-[44px] font-medium leading-[1.05] tracking-tight text-aubergine sm:text-[56px]">Emergency Brief</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            <span className="font-medium text-aubergine">{patient.name}</span>
            <span aria-hidden="true">·</span>
            <span>{patient.age}</span>
            <span aria-hidden="true">·</span>
            <span className="font-jetbrains text-[12.5px]">{patient.publicId}</span>
            <span aria-hidden="true">·</span>
            <span>
              Updated <span className="font-jetbrains text-[12.5px]">{data.updated}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{data.documentCount} documents</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-soft px-3.5 py-1.5 text-[13px] text-slate">
            <span className="h-1.5 w-1.5 rounded-full bg-prov-patient" aria-hidden="true" />
            Blood group <span className="font-jetbrains font-medium">{data.bloodGroup.value}</span> (Patient-provided)
          </span>
          <p className="text-xs text-ink-muted">
            Summary only. Open the{' '}
            {onOpenTimeline ? (
              <button type="button" onClick={onOpenTimeline} className="font-medium text-aubergine underline decoration-aubergine/30 underline-offset-2 hover:decoration-aubergine">
                Timeline
              </button>
            ) : (
              'Timeline'
            )}{' '}
            for the full history.
          </p>
        </div>
      </header>

      {/* Bento grid: 12 columns on desktop, one column on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 1. Medication History: cols 1-5, rows 1-3 */}
        <BriefCard title="Medication History" icon={Pill} className="lg:col-span-5 lg:col-start-1 lg:row-span-3 lg:row-start-1">
          <BigStat value={medications.length} unit="medicines recorded" badge={{ text: `${noStopRecorded} with no stop recorded` }} />
          <div className="mt-5">
            <RibbonAxis axis={data.axis} />
            <ul className="divide-y divide-hairline">
              {medications.map((medication) => (
                <MedRibbon key={medication.id} medication={medication} axis={data.axis} onOpenSource={onOpenSource} />
              ))}
            </ul>
          </div>
          <p className="mt-auto pt-4 text-[11px] leading-5 text-ink-muted">
            Ribbons show what the documents record. A medicine without a recorded stop is not confirmed as still being taken.
          </p>
        </BriefCard>

        {/* 2. Allergies: cols 6-8, row 1 */}
        <BriefCard title="Allergies" icon={ShieldAlert} className="lg:col-span-3 lg:col-start-6 lg:row-start-1">
          <BigStat value={allergies.documented.length} unit="documented" badge={allergyConflicts ? { text: `${allergyConflicts} conflict${allergyConflicts === 1 ? '' : 's'}`, tone: 'brick' } : undefined} size="md" />
          <ul className="mt-4 space-y-3">
            {allergies.documented.map((allergy) => (
              <li key={allergy.id}>
                <p className="text-sm font-semibold">
                  {allergy.substance} <span className="font-normal text-ink-muted">· {allergy.reaction}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <ProvenanceTag kind={allergy.provenance} />
                  {allergy.conflict && <Tag tone="brick">Conflict</Tag>}
                </div>
                <div className="mt-1.5">
                  <SourceChip source={allergy.source} onOpen={onOpenSource} />
                </div>
              </li>
            ))}
          </ul>
          {allergies.documentedAbsent.length > 0 && (
            <>
              <SubHeading>Documented as absent</SubHeading>
              <ul className="space-y-3">
                {allergies.documentedAbsent.map((item) => (
                  <li key={item.id}>
                    <p className="text-sm">"{item.statement}"</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <ProvenanceTag kind={item.provenance} />
                      {item.conflict && <Tag tone="brick">Conflict</Tag>}
                    </div>
                    <div className="mt-1.5">
                      <SourceChip source={item.source} onOpen={onOpenSource} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {allergies.patientProvided.length > 0 && (
            <>
              <SubHeading>Patient-provided, not from documents</SubHeading>
              <ul className="space-y-2">
                {allergies.patientProvided.map((item) => (
                  <li key={item.id}>
                    <p className="text-sm">
                      {item.substance} <span className="text-ink-muted">· {item.reaction}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ProvenanceTag kind={item.provenance} />
                      <SourceChip source={item.source} onOpen={onOpenSource} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </BriefCard>

        {/* 3. Recent Investigations: cols 6-8, row 2 */}
        <BriefCard title="Recent Investigations" icon={FlaskConical} className="lg:col-span-3 lg:col-start-6 lg:row-start-2">
          <ul className="divide-y divide-hairline">
            {investigations.map((result) => (
              <li key={result.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{result.test}</span>
                  <span className="font-jetbrains text-[10.5px] text-ink-muted">{result.date}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-fraunces text-[28px] font-medium leading-none">{result.value}</span>
                  <span className="font-jetbrains text-[11px] text-ink-muted">{result.unit}</span>
                </div>
                {result.range && <p className="mt-1 font-jetbrains text-[10.5px] text-ink-muted">Lab range {result.range}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <ProvenanceTag kind={result.provenance} />
                  {result.tags.map((tag) => (
                    <Tag key={tag.text} tone={tag.tone}>
                      {tag.text}
                    </Tag>
                  ))}
                </div>
                <div className="mt-1.5">
                  <SourceChip source={result.source} onOpen={onOpenSource} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-ink-muted">Values and units as written. No normal or abnormal labels added.</p>
        </BriefCard>

        {/* 4. Missing Information: cols 9-12, rows 1-2, Plum Mist */}
        <BriefCard title="Missing Information" icon={CalendarX2} tone="plum" className="lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1">
          <BigStat value={missing.lines.length} unit="gaps in the record" size="md" />
          <p className="mb-3 mt-1 text-xs text-ink-muted">Months with at least one document</p>
          <DotMatrix years={missing.years} documentMonths={missing.documentMonths} coveredUntil={missing.coveredUntil} gapRanges={missing.gapRanges} />
          <ul className="mt-5 space-y-2.5 border-t border-aubergine/10 pt-4">
            {missing.lines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-ochre" aria-hidden="true" />
                  {line.text}
                </span>
                <ProvenanceTag kind={line.provenance} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-4 text-ink-muted">A gap means nothing was recorded, not that nothing happened.</p>
        </BriefCard>

        {/* 5. Unresolved Contradictions: cols 6-12, row 3, dark, Brick accents */}
        <BriefCard
          title="Unresolved Contradictions"
          icon={TriangleAlert}
          tone="dark"
          className="border-l-4 border-brick lg:col-span-7 lg:col-start-6 lg:row-start-3"
          meta={<span className="font-inter text-[11px] text-white/60">Not resolved by AI. Doctor review required.</span>}
        >
          <BigStat value={conflicts.length} unit="need doctor review" valueClassName="text-brick" unitClassName="text-white/60" />
          <ul className="mt-4 space-y-4">
            {conflicts.map((conflict) => (
              <li key={conflict.id} className="rounded-2xl border border-aubergine-line p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Tag tone={conflict.kind === 'contradiction' ? 'brick' : 'ochre'} onDark>
                      {conflict.kind === 'contradiction' ? 'Contradiction' : 'Possible duplicate'}
                    </Tag>
                    <span className="text-[13px] font-medium text-white/90">{conflict.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => review(conflict)}
                    className="rounded-full border border-apricot px-3.5 py-1 text-xs font-semibold text-apricot transition-colors hover:bg-apricot/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot"
                  >
                    Review
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {conflict.sides.map((side, index) => (
                    <div key={side.source.id + index} className="flex flex-col gap-2 rounded-xl bg-aubergine-raised p-3">
                      <p className="text-[11px] text-white/55">{side.label}</p>
                      <p className="text-sm font-medium text-white">{side.statement}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        <ProvenanceTag kind={side.provenance} onDark />
                        <SourceChip source={side.source} onDark onOpen={onOpenSource} />
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </BriefCard>

        {/* 6. Major Medical Events: full width, row 4, Sage */}
        <BriefCard
          title="Major Medical Events"
          icon={Activity}
          tone="sage"
          className="lg:col-span-12 lg:row-start-4"
          meta={<span className="rounded-full bg-white/50 px-2 py-0.5 font-jetbrains text-[10.5px]">{events.length} events</span>}
        >
          <p className="mb-3 text-[11px] text-aubergine/70">Newest on the left. Scroll for older events.</p>
          <div className="-mx-1 overflow-x-auto pb-2">
            <ol className="relative flex min-w-max gap-0 px-1">
              {/* the timeline line, behind the nodes */}
              <span className="absolute left-1 right-1 top-[26px] h-px bg-aubergine/25" aria-hidden="true" />
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.type] ?? ClipboardList;
                return (
                  <li key={event.id} className="relative w-56 shrink-0 pr-4">
                    <time className="block font-jetbrains text-[11px] text-aubergine/75">{event.date}</time>
                    <span className="relative z-10 mt-2 block h-3 w-3 rounded-full border-2 border-aubergine bg-sage" aria-hidden="true" />
                    <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold leading-snug">
                      <Icon size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {event.title}
                    </p>
                    <div className="mt-2 flex flex-col items-start gap-1.5">
                      <ProvenanceTag kind={event.provenance} />
                      <SourceChip source={event.source} onOpen={onOpenSource} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </BriefCard>
      </div>
    </div>
  );
}
