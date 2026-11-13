import { FileText } from 'lucide-react';

/**
 * Clickable source reference: document name + date (date in mono).
 * For now a click only logs; later it opens the Source Viewer at the quote.
 *
 * @param {{ source: { id: string, name: string, date: string }, onDark?: boolean, onOpen?: (source) => void }} props
 */
export function SourceChip({ source, onDark = false, onOpen }) {
  if (!source) return null;
  const open = () => {
    if (onOpen) onOpen(source);
    else console.log('[SourceChip] open source', source);
  };
  return (
    <button
      type="button"
      onClick={open}
      title={`Open source: ${source.name}, ${source.date}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left font-inter text-[11px] leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
        onDark
          ? 'border-aubergine-line bg-white/5 text-white/80 hover:bg-white/10 focus-visible:outline-apricot'
          : 'border-hairline bg-white text-aubergine hover:border-aubergine/30 hover:bg-bone focus-visible:outline-aubergine'
      }`}
    >
      <FileText size={12} className="shrink-0 opacity-70" aria-hidden="true" />
      <span className="truncate">{source.name}</span>
      <span className={`shrink-0 font-jetbrains text-[10.5px] ${onDark ? 'text-white/55' : 'text-ink-muted'}`}>{source.date}</span>
    </button>
  );
}
