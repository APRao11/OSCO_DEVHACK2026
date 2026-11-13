import React, { useState } from 'react';
import { Check, FileText, Flag, Pencil } from 'lucide-react';
import type { ReviewItem, VerificationStatus } from '../../types/doctor';

export interface ReviewVerificationProps {
  reviewItems: ReviewItem[];
  onUpdateReviewItem: (id: string, newStatus: VerificationStatus, note?: string) => void;
  onOpenDocument: (docName: string) => void;
}

type ReviewFilter = 'all' | 'contradiction' | 'uncertain' | 'duplicate';

const FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'contradiction', label: 'Contradictions' },
  { id: 'uncertain', label: 'Uncertain' },
  { id: 'duplicate', label: 'Duplicates' },
];

const STATUS_TONE: Record<VerificationStatus, string> = {
  unverified: 'text-warning',
  verified: 'text-forest',
  corrected: 'text-eucalyptus-dark',
  flagged: 'text-warning',
};

export const ReviewVerification: React.FC<ReviewVerificationProps> = ({
  reviewItems,
  onUpdateReviewItem,
  onOpenDocument,
}) => {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const visibleItems = reviewItems.filter(
    (item) => activeFilter === 'all' || item.type === activeFilter ||
      (activeFilter === 'uncertain' && item.type === 'uncertain_extraction'),
  );

  const saveCorrection = (id: string) => {
    if (!correctionNote.trim()) return;
    onUpdateReviewItem(id, 'corrected', correctionNote.trim());
    setEditingItemId(null);
    setCorrectionNote('');
  };

  const renderSource = (label: string, source: ReviewItem['sourceA']) => (
    <div className="min-w-0 border-l border-[#D5DDD6] pl-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
        {label} · {source.date}
      </p>
      <p className="mt-1 text-sm leading-5 text-text-main">{source.value}</p>
      <p className="mt-1 text-xs text-text-secondary">{source.facility}</p>
      <button
        type="button"
        onClick={() => onOpenDocument(source.docName)}
        className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-forest hover:underline"
      >
        <FileText size={11} />
        {source.docName} · p.{source.page}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="border-b border-[#D5DDD6] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-eucalyptus-dark">
          Patient record
        </p>
        <h1 className="mt-1 text-4xl leading-none text-forest sm:text-5xl">
          Review & Verification
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
          Inspect conflicting, uncertain, or repeated entries and record a review decision.
        </p>
      </header>

      <div className="flex items-center gap-4 overflow-x-auto border-b border-[#D5DDD6]">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            aria-pressed={activeFilter === filter.id}
            className={`shrink-0 border-b-2 px-1 py-3 text-xs transition-colors ${
              activeFilter === filter.id
                ? 'border-forest font-semibold text-forest'
                : 'border-transparent text-text-secondary hover:text-text-main'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {visibleItems.length ? (
        <div className="divide-y divide-[#D5DDD6] border-y border-[#D5DDD6]">
          {visibleItems.map((item) => {
            const isEditing = editingItemId === item.id;
            return (
              <details key={item.id} className="group py-4">
                <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span>
                    <span className="block text-sm font-semibold text-text-main group-open:text-forest">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      {item.category}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase">
                    <span className={item.severity === 'high' ? 'text-warning' : 'text-text-muted'}>
                      {item.severity} priority
                    </span>
                    <span className={STATUS_TONE[item.status]}>{item.status}</span>
                  </span>
                </summary>

                <div className="mt-4 space-y-4">
                  <p className="max-w-3xl text-sm leading-6 text-text-secondary">
                    {item.description}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderSource('Source A', item.sourceA)}
                    {item.sourceB ? (
                      renderSource('Source B', item.sourceB)
                    ) : (
                      <p className="border-l border-[#D5DDD6] pl-3 text-xs leading-5 text-text-secondary">
                        One source is available. The listed confidence is part of the demo record.
                        Confidence: {item.confidence}%.
                      </p>
                    )}
                  </div>

                  {item.doctorNotes && (
                    <p className="border-l-2 border-eucalyptus pl-3 text-xs leading-5 text-text-secondary">
                      <span className="font-medium text-text-main">Review note: </span>
                      {item.doctorNotes}
                    </p>
                  )}

                  {isEditing && (
                    <div className="max-w-2xl space-y-2">
                      <label
                        htmlFor={`correction-${item.id}`}
                        className="block text-xs font-medium text-text-main"
                      >
                        Correction note
                      </label>
                      <textarea
                        id={`correction-${item.id}`}
                        rows={3}
                        value={correctionNote}
                        onChange={(event) => setCorrectionNote(event.target.value)}
                        className="w-full border border-border-medium bg-white p-3 text-sm text-text-main outline-none focus:border-forest"
                        placeholder="Enter the corrected value or note"
                      />
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemId(null);
                            setCorrectionNote('');
                          }}
                          className="text-xs text-text-secondary hover:text-text-main"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveCorrection(item.id)}
                          disabled={!correctionNote.trim()}
                          className="text-xs font-semibold text-forest hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save correction
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#D5DDD6] pt-3">
                    <button
                      type="button"
                      onClick={() => onUpdateReviewItem(item.id, 'flagged', 'Flagged for further review.')}
                      className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-warning"
                    >
                      <Flag size={13} />
                      Flag for review
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(item.id);
                        setCorrectionNote(item.doctorNotes || '');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-forest"
                    >
                      <Pencil size={13} />
                      Correct
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateReviewItem(item.id, 'verified', 'Reviewed and verified in demo.')
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-forest hover:underline"
                    >
                      <Check size={13} />
                      Verify
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="border-y border-[#D5DDD6] py-6 text-sm text-text-secondary">
          {reviewItems.length ? 'No items match this filter.' : 'No review items for this patient.'}
        </p>
      )}
    </div>
  );
};
