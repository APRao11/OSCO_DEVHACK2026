const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const key = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * Record coverage by month (rows = years, columns = months).
 * Orchid = documents with AI-extracted items only, Moss = at least one
 * doctor-verified item, empty = no record, faint dashed = after the last
 * update. Long gaps are ringed with an Ochre dashed outline.
 *
 * @param {{ years: number[], documentMonths: { iso: string, verified: boolean }[],
 *           coveredUntil: string, gapRanges: { fromIso: string, toIso: string }[] }} props
 */
export function DotMatrix({ years, documentMonths, coveredUntil, gapRanges }) {
  const byMonth = new Map(documentMonths.map((m) => [m.iso.slice(0, 7), m]));
  const covered = (year, month) => key(year, month) <= coveredUntil.slice(0, 7);

  const coveredMonths = years.flatMap((y) => MONTHS.map((_, i) => key(y, i + 1))).filter((k) => k <= coveredUntil.slice(0, 7));
  const summary =
    `Documents in ${documentMonths.length} of ${coveredMonths.length} months from Jan ${years[0]} to ` +
    `${MONTH_NAMES[Number(coveredUntil.slice(5, 7)) - 1]} ${coveredUntil.slice(0, 4)}. ` +
    gapRanges.map((g) => `Gap from ${g.fromIso} to ${g.toIso}.`).join(' ');

  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label={summary}
        className="grid items-center gap-x-[5px] gap-y-[7px]"
        style={{ gridTemplateColumns: 'auto repeat(12, minmax(0, 1fr))' }}
      >
        <span style={{ gridRow: 1, gridColumn: 1 }} />
        {MONTHS.map((m, i) => (
          <span key={`h-${i}`} className="text-center font-jetbrains text-[9.5px] text-ink-muted" style={{ gridRow: 1, gridColumn: i + 2 }} aria-hidden="true">
            {m}
          </span>
        ))}

        {years.map((year, row) => (
          <YearRow key={year} year={year} gridRow={row + 2} byMonth={byMonth} covered={covered} />
        ))}

        {/* Ochre dashed ring around each long empty stretch (same row only). */}
        {gapRanges.map((gap) => {
          const year = Number(gap.fromIso.slice(0, 4));
          const row = years.indexOf(year);
          if (row === -1) return null;
          const from = Number(gap.fromIso.slice(5, 7));
          const to = Number(gap.toIso.slice(5, 7));
          return (
            <span
              key={`${gap.fromIso}-${gap.toIso}`}
              aria-hidden="true"
              className="pointer-events-none -mx-[3px] h-[22px] rounded-full border-[1.5px] border-dashed border-ochre"
              style={{ gridRow: row + 2, gridColumn: `${from + 1} / ${to + 2}` }}
            />
          );
        })}
      </div>

      <figcaption className="mt-4 flex flex-wrap gap-x-3.5 gap-y-1.5 font-inter text-[10.5px] text-ink-muted">
        <LegendItem dot="bg-orchid" label="AI-extracted only" />
        <LegendItem dot="bg-moss" label="Doctor-verified" />
        <LegendItem dot="border border-aubergine/15 bg-white/70" label="No record" />
        <LegendItem dot="border border-dashed border-aubergine/25" label="After last update" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full border-[1.5px] border-dashed border-ochre" aria-hidden="true" />
          Long gap
        </span>
      </figcaption>
    </figure>
  );
}

function YearRow({ year, gridRow, byMonth, covered }) {
  return (
    <>
      <span className="pr-1 font-jetbrains text-[10px] text-ink-muted" style={{ gridRow, gridColumn: 1 }}>
        {year}
      </span>
      {MONTHS.map((_, i) => {
        const month = byMonth.get(key(year, i + 1));
        const isCovered = covered(year, i + 1);
        const label = `${MONTH_NAMES[i]} ${year}: ${month ? (month.verified ? 'doctor-verified' : 'AI-extracted only') : isCovered ? 'no record' : 'after last update'}`;
        const style = month
          ? month.verified
            ? 'bg-moss'
            : 'bg-orchid'
          : isCovered
            ? 'border border-aubergine/15 bg-white/70'
            : 'border border-dashed border-aubergine/25';
        return (
          <span key={i} className="flex justify-center" style={{ gridRow, gridColumn: i + 2 }} title={label}>
            <span className={`block aspect-square w-full max-w-[14px] rounded-full ${style}`} />
          </span>
        );
      })}
    </>
  );
}

function LegendItem({ dot, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
