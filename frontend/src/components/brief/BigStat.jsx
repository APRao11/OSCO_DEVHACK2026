const BADGE_TONES = {
  neutral: 'bg-aubergine/8 text-aubergine',
  brick: 'bg-brick-soft text-brick',
  ochre: 'bg-ochre-soft text-[#7A5A16]',
  onDark: 'bg-white/10 text-white/80',
};

/**
 * Big number in Fraunces with a small mono unit and an optional tiny pill badge.
 *
 * @param {{ value: string | number, unit?: string, badge?: { text: string, tone?: keyof BADGE_TONES },
 *           valueClassName?: string, unitClassName?: string, size?: 'md' | 'lg' }} props
 */
export function BigStat({ value, unit, badge, valueClassName = 'text-aubergine', unitClassName = 'text-ink-muted', size = 'lg' }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={`font-fraunces font-medium leading-none tracking-tight ${size === 'lg' ? 'text-[44px]' : 'text-[30px]'} ${valueClassName}`}>{value}</span>
      {unit && <span className={`font-jetbrains text-[11px] ${unitClassName}`}>{unit}</span>}
      {badge && (
        <span className={`self-start rounded-full px-2 py-0.5 font-inter text-[10.5px] font-medium ${BADGE_TONES[badge.tone ?? 'neutral']}`}>
          {badge.text}
        </span>
      )}
    </div>
  );
}
