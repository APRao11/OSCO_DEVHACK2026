import React from 'react';
import { X } from 'lucide-react';
import type { TimelineEvent } from '../../types/patient';

export interface TimelineDetailDrawerProps {
  event: TimelineEvent | null;
  onClose: () => void;
  onOpenDocument: (docName: string) => void;
}

export const TimelineDetailDrawer: React.FC<TimelineDetailDrawerProps> = ({
  event,
  onClose,
  onOpenDocument,
}) => {
  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-detail-title"
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
        onClick={(click) => click.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <time className="text-xs text-text-muted">{event.date}</time>
            <h2 id="timeline-detail-title" className="mt-1 font-heading text-lg font-semibold text-forest">
              {event.title}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">{event.category}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close event details" className="rounded-md p-1.5 text-text-secondary hover:bg-osco-bg">
            <X size={18} />
          </button>
        </header>

        <div className="mt-5 space-y-4">
          <p className="text-sm leading-6 text-text-main">{event.description}</p>
          {event.extractedDetails.length > 0 && (
            <dl className="divide-y divide-border-subtle border-y border-border-subtle">
              {event.extractedDetails.map((detail) => (
                <div key={detail.label} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-text-secondary">{detail.label}</dt>
                  <dd className="text-right font-medium text-text-main">{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {event.medicationDetails && (
            <p className="text-sm text-text-secondary">
              {event.medicationDetails.name} · {event.medicationDetails.status}
            </p>
          )}
          {event.sourceDoc && (
            <button type="button" onClick={() => onOpenDocument(event.sourceDoc)} className="text-sm font-medium text-forest hover:underline">
              View source document
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-osco-bg px-4 py-2.5 text-sm font-medium text-text-main hover:bg-eucalyptus-subtle">
          Done
        </button>
      </section>
    </div>
  );
};
