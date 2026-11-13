/**
 * The page frame shared by the doctor's four record tabs (Report, Medical
 * History, Alert and Reviews, Add Changes): Bone background, Fraunces title,
 * the patient line with the ID and dates in mono, and a right-hand slot.
 * One quick 200 ms fade-in, nothing else.
 *
 * @param {{ title: string, patient: { name: string, age?: number | null, publicId: string },
 *           meta?: import('react').ReactNode[], aside?: import('react').ReactNode, children: import('react').ReactNode }} props
 */
export function DoctorPageShell({ title, patient, meta = [], aside, children }) {
  const parts = [
    <span key="name" className="font-medium text-aubergine">
      {patient.name}
    </span>,
    patient.age ? <span key="age">{patient.age}</span> : null,
    <span key="id" className="font-jetbrains text-[12.5px]">
      {patient.publicId}
    </span>,
    ...meta,
  ].filter(Boolean);

  return (
    <div className="brief-fade-in rounded-[28px] bg-bone p-4 font-inter text-aubergine sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-fraunces text-[44px] font-medium leading-[1.05] tracking-tight text-aubergine sm:text-[56px]">{title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            {parts.map((part, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                {part}
              </span>
            ))}
          </p>
        </div>
        {aside && <div className="flex flex-col items-start gap-2 lg:items-end">{aside}</div>}
      </header>
      {children}
    </div>
  );
}

/** Explicit empty state inside a card: what "empty" does and does not mean. */
export function EmptyNote({ children, onDark = false }) {
  return (
    <p className={`border-l-2 pl-3 text-[13px] leading-6 ${onDark ? 'border-white/20 text-white/65' : 'border-aubergine/15 text-ink-muted'}`}>{children}</p>
  );
}

/** Small pill used for status labels across the doctor tabs. */
export function Pill({ tone = 'neutral', onDark = false, children }) {
  const tones = {
    neutral: onDark ? 'bg-white/10 text-white/80' : 'bg-aubergine/8 text-aubergine',
    brick: onDark ? 'bg-brick text-white' : 'bg-brick-soft text-brick',
    ochre: onDark ? 'bg-ochre text-aubergine' : 'bg-ochre-soft text-[#7A5A16]',
    moss: onDark ? 'bg-moss text-white' : 'bg-moss/15 text-[#356340]',
    slate: 'bg-slate-soft text-slate',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-inter text-[10.5px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** A compact statistic tile: small label, big Fraunces number, optional note. Matches the Report's BigStat. */
export function StatTile({ label, value, unit, tone = 'chalk', note, onClick }) {
  const tones = {
    chalk: 'bg-chalk text-aubergine',
    plum: 'bg-plum-mist text-aubergine',
    sage: 'bg-sage text-aubergine',
    dark: 'bg-aubergine text-white',
  };
  const numberTone = tone === 'dark' ? 'text-brick' : 'text-aubergine';
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex flex-col rounded-3xl p-5 text-left ${tones[tone]} ${onClick ? 'transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aubergine' : ''}`}
    >
      <span className={`font-inter text-[11px] font-semibold uppercase tracking-[0.12em] ${tone === 'dark' ? 'text-white/60' : 'text-ink-muted'}`}>{label}</span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className={`font-fraunces text-[34px] font-medium leading-none tracking-tight ${numberTone}`}>{value}</span>
        {unit && <span className={`font-jetbrains text-[11px] ${tone === 'dark' ? 'text-white/60' : 'text-ink-muted'}`}>{unit}</span>}
      </span>
      {note && <span className={`mt-1.5 text-xs ${tone === 'dark' ? 'text-white/60' : 'text-ink-muted'}`}>{note}</span>}
    </Wrapper>
  );
}

/** What the patient allowed this doctor to do, shown on every tab. */
export function AccessPill({ level }) {
  const edit = level === 'edit';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] ${edit ? 'bg-sage text-aubergine' : 'bg-slate-soft text-slate'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${edit ? 'bg-moss' : 'bg-slate'}`} aria-hidden="true" />
      {edit ? 'Patient allowed view and correct' : 'Patient allowed view only'}
    </span>
  );
}

/** Filter chip used above lists. */
export function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-aubergine text-white' : 'bg-white/70 text-aubergine/75 hover:bg-white hover:text-aubergine'
      }`}
    >
      {children}
      {count != null && <span className={`font-jetbrains text-[11px] ${active ? 'text-white/70' : 'text-ink-muted'}`}>{count}</span>}
    </button>
  );
}

/** Loading and error states for a tab, inside the same frame as the loaded page. */
export function TabStatus({ title, state }) {
  return (
    <div className="brief-fade-in rounded-[28px] bg-bone p-8 font-inter text-aubergine sm:p-12">
      <h1 className="font-fraunces text-[44px] font-medium leading-[1.05] tracking-tight sm:text-[56px]">{title}</h1>
      <p className={`mt-3 text-sm ${state.status === 'error' ? 'text-brick' : 'text-ink-muted'}`}>
        {state.status === 'error' ? state.message : 'Loading the patient record…'}
      </p>
    </div>
  );
}
