import { useId } from 'react';
import { EllipsisVertical } from 'lucide-react';

const TONES = {
  chalk: { card: 'bg-chalk text-aubergine', icon: 'border-hairline bg-white text-aubergine', menu: 'text-ink-muted hover:bg-aubergine/5' },
  plum: { card: 'bg-plum-mist text-aubergine', icon: 'border-aubergine/10 bg-white/70 text-aubergine', menu: 'text-ink-muted hover:bg-aubergine/5' },
  sage: { card: 'bg-sage text-aubergine', icon: 'border-aubergine/10 bg-white/60 text-aubergine', menu: 'text-aubergine/60 hover:bg-aubergine/5' },
  dark: { card: 'bg-aubergine text-white', icon: 'border-aubergine-line bg-aubergine-raised text-white', menu: 'text-white/60 hover:bg-white/10' },
};

/**
 * Card shell for the Emergency Brief bento grid: line icon in a circle,
 * title, optional header meta, three-dot menu, then the body.
 *
 * @param {{ title: string, icon: import('react').ComponentType<{ size?: number }>,
 *           tone?: keyof TONES, meta?: import('react').ReactNode, className?: string,
 *           children: import('react').ReactNode }} props
 */
export function BriefCard({ title, icon: Icon, tone = 'chalk', meta, className = '', children }) {
  const headingId = useId();
  const style = TONES[tone];
  return (
    <section aria-labelledby={headingId} className={`flex min-w-0 flex-col rounded-3xl p-5 sm:p-6 ${style.card} ${className}`}>
      <header className="mb-4 flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${style.icon}`} aria-hidden="true">
          <Icon size={16} strokeWidth={1.75} />
        </span>
        <h2 id={headingId} className="min-w-0 flex-1 truncate font-inter text-[15px] font-semibold tracking-normal text-inherit">
          {title}
        </h2>
        {meta}
        <button
          type="button"
          aria-label={`More options for ${title}`}
          onClick={() => console.log('[BriefCard] menu', title)}
          className={`-mr-1.5 rounded-full p-1.5 transition-colors ${style.menu}`}
        >
          <EllipsisVertical size={16} />
        </button>
      </header>
      {children}
    </section>
  );
}
