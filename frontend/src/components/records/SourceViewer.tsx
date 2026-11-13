import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { layoutTextItems } from '../../utils/pdfTextLayout.js';
import { DOCUMENT_TYPE_LABELS, formatRecordDate } from '../../records/format';
import type { SourceTarget } from '../../types/records';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Defined once, outside the component, as react-pdf requires.
// /standard_fonts/ is served from pdfjs-dist by the plugin in vite.config.ts.
const PDF_OPTIONS = { standardFontDataUrl: '/standard_fonts/' };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Whitespace-insensitive comparison, to confirm the rendered text matches the stored quote. */
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

type ViewMode = 'pdf' | 'text';

export interface SourceViewerProps {
  target: SourceTarget | null;
  onClose: () => void;
}

/**
 * Source Viewer (MVP document section 8.7): click a fact, see the original.
 *
 * Renders the stored PDF page with react-pdf and highlights the characters
 * [quoteStart, quoteEnd) that the Quote Verifier recorded. Those offsets
 * index the page text the worker built with layoutTextItems(); the same
 * function runs here on react-pdf's text items, so each text-layer span knows
 * which characters of the page text it holds, and only the overlap with the
 * quote is wrapped in <mark>.
 *
 * Falls back to the stored page text with the quote marked when there is no
 * file, the PDF cannot be loaded, or the rendered text does not reproduce the
 * stored quote at those offsets (so a highlight is never put in the wrong place).
 */
export const SourceViewer: React.FC<SourceViewerProps> = ({ target, onClose }) => {
  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;
  // Remount per target so page, ranges and fallback state start fresh.
  return <SourceViewerDialog key={`${target.document.id}:${target.page}:${target.quoteStart}`} target={target} onClose={onClose} />;
};

const SourceViewerDialog: React.FC<{ target: SourceTarget; onClose: () => void }> = ({ target, onClose }) => {
  const { document: doc } = target;
  const [mode, setMode] = useState<ViewMode>(doc.fileUrl ? 'pdf' : 'text');
  const [fallbackReason, setFallbackReason] = useState<string | null>(doc.fileUrl ? null : 'The original file is not available here.');
  const [pageNumber, setPageNumber] = useState(target.page);
  const [numPages, setNumPages] = useState(doc.pageCount);
  const [ranges, setRanges] = useState<Array<[number, number] | null> | null>(null);
  const [width, setWidth] = useState(560);
  const pageContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = pageContainer.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onQuotePage = pageNumber === target.page;

  const fallBack = useCallback((reason: string) => {
    setFallbackReason(reason);
    setMode('text');
  }, []);

  // Map the stored offsets onto this page's text items.
  const handleText = useCallback(
    ({ items }: TextContent) => {
      if (!onQuotePage) {
        setRanges(null);
        return;
      }
      const layout = layoutTextItems(items as TextItem[]);
      if (squash(layout.text.slice(target.quoteStart, target.quoteEnd)) !== squash(target.quote)) {
        fallBack('The rendered page does not reproduce the stored quote at its recorded position, so it is shown in the stored page text instead.');
        return;
      }
      setRanges(layout.ranges);
    },
    [onQuotePage, target.quoteStart, target.quoteEnd, target.quote, fallBack],
  );

  const customTextRenderer = useCallback(
    ({ str, itemIndex }: { str: string; itemIndex: number }) => {
      const range = ranges?.[itemIndex];
      if (!range) return escapeHtml(str);
      const [itemStart, itemEnd] = range;
      const from = Math.max(target.quoteStart, itemStart);
      const to = Math.min(target.quoteEnd, itemEnd);
      if (from >= to) return escapeHtml(str);
      const a = from - itemStart;
      const b = to - itemStart;
      return `${escapeHtml(str.slice(0, a))}<mark class="osco-quote">${escapeHtml(str.slice(a, b))}</mark>${escapeHtml(str.slice(b))}`;
    },
    [ranges, target.quoteStart, target.quoteEnd],
  );

  const scrollToQuote = useCallback(() => {
    pageContainer.current?.querySelector('mark.osco-quote')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const pageText = doc.pages.find((p) => p.pageNumber === target.page)?.text ?? '';
  const textFallback = useMemo(
    () => (
      <pre className="whitespace-pre-wrap break-words rounded-lg border border-border-subtle bg-white p-4 font-mono text-[12.5px] leading-6 text-text-main">
        {pageText.slice(0, target.quoteStart)}
        <mark className="rounded-sm bg-citron px-0.5 text-text-main">{pageText.slice(target.quoteStart, target.quoteEnd)}</mark>
        {pageText.slice(target.quoteEnd)}
      </pre>
    ),
    [pageText, target.quoteStart, target.quoteEnd],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-viewer-title"
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-osco-bg shadow-xl sm:rounded-2xl lg:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Document, page and quote are always shown beside the viewer (8.7). */}
        <aside className="shrink-0 border-b border-border-subtle bg-white p-5 lg:w-80 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-eucalyptus-dark">Source</p>
              <h2 id="source-viewer-title" className="mt-1 font-heading text-base font-semibold leading-snug text-forest">
                {doc.name}
              </h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close source viewer" className="rounded-md p-1.5 text-text-secondary hover:bg-osco-bg">
              <X size={18} />
            </button>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Type</dt>
              <dd className="text-right text-text-main">{DOCUMENT_TYPE_LABELS[doc.documentType]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Document date</dt>
              <dd className="text-right text-text-main">
                {doc.documentDate ? formatRecordDate(doc.documentDate) : `${doc.documentDateText ?? 'None'} (unclear)`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-secondary">Page</dt>
              <dd className="text-right text-text-main">
                {target.page} of {doc.pageCount}
              </dd>
            </div>
          </dl>
          <figure className="mt-5">
            <figcaption className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">Verified quote</figcaption>
            <blockquote className="mt-2 border-l-2 border-citron pl-3 text-sm leading-6 text-text-main">{target.quote}</blockquote>
          </figure>
          {fallbackReason && (
            <p className="mt-5 flex gap-2 rounded-lg bg-warning-subtle p-3 text-xs leading-5 text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {fallbackReason}
            </p>
          )}
          {doc.fileUrl && (
            <div className="mt-5 flex gap-2" role="group" aria-label="View">
              {(['pdf', 'text'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-full px-3 py-1.5 text-xs ${mode === value ? 'bg-forest text-white' : 'bg-osco-bg text-text-secondary hover:bg-eucalyptus-subtle'}`}
                >
                  {value === 'pdf' ? 'Original page' : 'Page text'}
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          {mode === 'pdf' && doc.fileUrl && (
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-white px-4 py-2 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <FileText size={13} /> Page {pageNumber} of {numPages}
                {!onQuotePage && <span className="text-warning"> · the quote is on page {target.page}</span>}
              </span>
              <span className="flex gap-1">
                <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)} className="rounded p-1 hover:bg-osco-bg disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" aria-label="Next page" disabled={pageNumber >= numPages} onClick={() => setPageNumber((p) => p + 1)} className="rounded p-1 hover:bg-osco-bg disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </span>
            </div>
          )}
          <div ref={pageContainer} className="min-h-[50vh] flex-1 overflow-auto p-4">
            {mode === 'pdf' && doc.fileUrl ? (
              <Document
                file={doc.fileUrl}
                options={PDF_OPTIONS}
                onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                onLoadError={() => fallBack('The original PDF could not be loaded, so the stored page text is shown.')}
                loading={<p className="p-6 text-sm text-text-secondary">Loading original document…</p>}
                className="flex justify-center"
              >
                <Page
                  pageNumber={pageNumber}
                  width={Math.min(width, 900)}
                  renderAnnotationLayer={false}
                  onGetTextSuccess={handleText}
                  customTextRenderer={onQuotePage && ranges ? customTextRenderer : undefined}
                  onRenderTextLayerSuccess={onQuotePage ? scrollToQuote : undefined}
                  className="osco-source-page shadow-md"
                />
              </Document>
            ) : (
              textFallback
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
