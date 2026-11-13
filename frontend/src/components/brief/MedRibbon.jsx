import { ProvenanceTag } from './ProvenanceTag';
import { SourceChip } from './SourceChip';

/** Months since year 0, from 'YYYY-MM' or 'YYYY-MM-DD'. */
const monthIndex = (iso) => {
  const [year, month = '1', day = '1'] = iso.split('-');
  return Number(year) * 12 + Number(month) - 1 + (Number(day) - 1) / 31;
};

// Active drugs: aubergine shades, one per dose segment. Stopped drugs: greyed.
const ACTIVE_FILLS = ['#4A3D57', '#6A5A7C', '#8C7DA0'];
const STOPPED_FILLS = ['#D3CCC2', '#BEB6AB', '#ADA499'];
// Width (in % of the track) drawn for a dose whose start date is not documented.
const UNKNOWN_START_WIDTH = 7;

/** Year ticks shared by every ribbon in the card. */
export function RibbonAxis({ axis }) {
  const start = monthIndex(axis.from);
  const span = monthIndex(axis.to) - start;
  return (
    <div className="relative mb-1 h-4 font-jetbrains text-[10px] text-ink-muted" aria-hidden="true">
      {axis.years.map((year) => {
        const left = ((year * 12 - start) / span) * 100;
        if (left < 0 || left > 100) return null;
        return (
          <span key={year} className="absolute -translate-x-1/2" style={{ left: `${left}%` }}>
            {year}
          </span>
        );
      })}
    </div>
  );
}

/**
 * One drug's life on a shared time axis: a segment per dose, labelled in mono.
 * Stopped drugs get a greyed ribbon with a rounded end at the stop date.
 * Drugs with no stop end square at their last record, because the records
 * cannot show what happened after that.
 */
export function MedRibbon({ medication, axis, onOpenSource }) {
  const start = monthIndex(axis.from);
  const span = monthIndex(axis.to) - start;
  const pct = (iso) => Math.min(100, Math.max(0, ((monthIndex(iso) - start) / span) * 100));

  const stopped = Boolean(medication.stopped);
  const endIso = stopped ? medication.stopped.iso : medication.lastRecord.iso;
  const fills = stopped ? STOPPED_FILLS : ACTIVE_FILLS;

  const segments = medication.segments.map((segment, index) => {
    const next = medication.segments[index + 1];
    const right = next?.fromIso ? pct(next.fromIso) : pct(endIso);
    const unknownStart = !segment.fromIso;
    const left = unknownStart ? Math.max(0, right - UNKNOWN_START_WIDTH) : pct(segment.fromIso);
    return { ...segment, left, width: Math.max(right - left, 0.8), unknownStart, isFirst: index === 0, isLast: !next };
  });

  const sources = [
    ...medication.segments.map((s) => s.source),
    medication.stopped?.source ?? medication.lastRecord?.source,
  ].filter((source, i, all) => source && all.findIndex((s) => s.id === source.id) === i);

  const doseTrail = [
    ...medication.segments.map((s) => `${s.dose} (${s.fromLabel})`),
    stopped ? `stopped ${medication.stopped.label}` : `last record ${medication.lastRecord.label}`,
  ].join(' → ');

  return (
    <li className="py-4 first:pt-1 last:pb-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`font-inter text-[15px] font-semibold ${stopped ? 'text-ink-muted' : 'text-aubergine'}`}>{medication.name}</span>
          <ProvenanceTag kind={medication.provenance} />
        </span>
        <span className={`font-inter text-xs ${stopped ? 'text-ink-muted' : 'font-medium text-aubergine'}`}>{medication.statusText}</span>
      </div>

      <div className="relative h-7 rounded-full bg-aubergine/[0.05]" role="img" aria-label={`${medication.name}: ${doseTrail}`}>
        {segments.map((segment, index) => {
          const roundLeft = segment.isFirst && !segment.unknownStart;
          const roundRight = segment.isLast && stopped;
          const fill = fills[index % fills.length];
          return (
            <div
              key={`${segment.dose}-${index}`}
              className={`absolute inset-y-0 flex items-center overflow-hidden px-2 ${roundLeft ? 'rounded-l-full' : ''} ${roundRight ? 'rounded-r-full' : ''} ${
                segment.unknownStart ? 'border-y border-l border-dashed border-ink-muted/60' : ''
              } ${index > 0 ? 'border-l-2 border-l-chalk' : ''}`}
              style={{
                left: `${segment.left}%`,
                width: `${segment.width}%`,
                background: segment.unknownStart ? `linear-gradient(90deg, transparent, ${fill})` : fill,
              }}
            >
              {segment.width > 11 && (
                <span className={`truncate font-jetbrains text-[10.5px] ${stopped ? 'text-aubergine' : 'text-white'}`}>{segment.dose}</span>
              )}
            </div>
          );
        })}
        {!stopped && (
          // Square end + tick: the last record, not a known end.
          <span className="absolute inset-y-[-3px] w-px bg-aubergine" style={{ left: `${pct(endIso)}%` }} aria-hidden="true" />
        )}
      </div>

      <p className="mt-1.5 font-jetbrains text-[10.5px] leading-5 text-ink-muted">{doseTrail}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <SourceChip key={source.id} source={source} onOpen={onOpenSource} />
        ))}
      </div>
    </li>
  );
}
