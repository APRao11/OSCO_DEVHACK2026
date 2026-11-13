import React from 'react';
import { FileText, X } from 'lucide-react';
import type { UploadedDocument } from '../../types/patient';

export interface DocumentViewerModalProps {
  document: UploadedDocument | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ document, onClose }) => {
  if (!document) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-detail-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <FileText size={20} className="shrink-0 text-forest" />
            <div className="min-w-0">
              <h2 id="document-detail-title" className="truncate font-heading text-base font-semibold text-forest">
                {document.name}
              </h2>
              <p className="mt-1 text-xs text-text-secondary">{document.fileFormat} · {document.size}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close document details" className="rounded-md p-1.5 text-text-secondary hover:bg-osco-bg">
            <X size={17} />
          </button>
        </header>
        <dl className="mt-5 space-y-3 border-y border-border-subtle py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Type</dt>
            <dd className="text-right text-text-main">{document.type}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Added</dt>
            <dd className="text-right text-text-main">{document.uploadDate}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Status</dt>
            <dd className="text-right text-text-main">{document.status === 'Completed' ? 'Ready' : document.status}</dd>
          </div>
          {document.relevantDate && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Document date</dt>
              <dd className="text-right text-text-main">{document.relevantDate}</dd>
            </div>
          )}
          {document.facility && (
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Findings</dt>
              <dd className="text-right text-text-main">{document.facility}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs leading-5 text-text-secondary">
          The original file is stored securely and kept unchanged. Open Upload Documents to see the findings read from it.
        </p>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark">
          Close
        </button>
      </section>
    </div>
  );
};
