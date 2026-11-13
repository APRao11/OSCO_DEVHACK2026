import React from 'react';
import { ExternalLink, FileText, RotateCcw } from 'lucide-react';
import { ANSWER_STATUS } from '../../records/useRecordsChat';
import { formatRecordDate } from '../../records/format';
import type { ChatMessage } from '../../types/patient';
import type { SourceTarget } from '../../types/records';

export interface ChatAnswerDetailsProps {
  message: ChatMessage;
  title?: string;
  onOpenSource: (target: SourceTarget) => void;
  onRetry?: (question: string) => void;
  retryDisabled?: boolean;
}

/**
 * Under an assistant answer: whether it is documented, the server-checked
 * sources (document, page, exact quote) that open in the Source Viewer, and
 * a retry button when the request failed.
 */
export const ChatAnswerDetails: React.FC<ChatAnswerDetailsProps> = ({
  message,
  title = 'Sources from your records',
  onOpenSource,
  onRetry,
  retryDisabled,
}) => {
  if (message.sender !== 'assistant' || !message.status) return null;
  const status = ANSWER_STATUS[message.status];
  const sources = message.sources ?? [];

  return (
    <>
      <div className="mt-2">
        <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${status.className}`}>
          {status.label}
        </span>
      </div>

      {sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider flex items-center gap-1">
            <FileText size={11} className="text-forest" />
            {title}:
          </div>
          <div className="space-y-1.5">
            {sources.map((src, i) => {
              const target = src.target;
              const heading = (
                <>
                  <span className="truncate">
                    {src.docName}
                    {src.page ? ` (Page ${src.page})` : ''}
                  </span>
                  <span className="text-text-muted shrink-0">{src.date ? formatRecordDate(src.date) : ''}</span>
                </>
              );
              return (
                <div key={i} className="p-2 bg-osco-bg rounded border border-border-subtle text-xs space-y-0.5">
                  {target ? (
                    <button
                      type="button"
                      onClick={() => onOpenSource(target)}
                      className="w-full flex items-center justify-between gap-2 font-mono text-[11px] text-forest font-semibold text-left hover:underline cursor-pointer"
                      title="Open the original page with this quote highlighted"
                    >
                      {heading}
                      <ExternalLink size={11} className="shrink-0" />
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-forest font-semibold">{heading}</div>
                  )}
                  <p className="text-[11px] text-text-secondary italic">“{src.excerpt}”</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message.status === 'error' && message.retryQuestion && onRetry && (
        <button
          type="button"
          disabled={retryDisabled}
          onClick={() => onRetry(message.retryQuestion!)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-forest hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
        >
          <RotateCcw size={11} /> Try again
        </button>
      )}
    </>
  );
};
