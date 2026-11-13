import React, { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import type { UploadedDocument } from '../../types/patient';

export interface DocumentsLibraryProps {
  documents: UploadedDocument[];
  onOpenDocument: (doc: UploadedDocument) => void;
  onNavigateUpload: () => void;
}

export const DocumentsLibrary: React.FC<DocumentsLibraryProps> = ({
  documents,
  onOpenDocument,
  onNavigateUpload,
}) => {
  const [query, setQuery] = useState('');
  const filteredDocuments = documents.filter((document) =>
    `${document.name} ${document.fileFormat} ${document.type}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <p className="mb-2 text-sm text-text-secondary">Your records</p>
          <h1 className="font-heading text-3xl font-semibold text-forest">Documents</h1>
        </div>
        <button type="button" onClick={onNavigateUpload} className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark">
          <Upload size={15} /> Upload documents
        </button>
      </header>

      <label className="block max-w-sm">
        <span className="sr-only">Search documents</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search documents"
          className="w-full rounded-lg border border-border-subtle bg-white px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none"
        />
      </label>

      {filteredDocuments.length ? (
        <ul className="divide-y divide-border-subtle border-y border-border-subtle">
          {filteredDocuments.map((document) => (
            <li key={document.id} className="flex items-center gap-3 py-4">
              <FileText size={18} className="shrink-0 text-forest" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-main">{document.name}</p>
                <p className="mt-1 text-xs text-text-secondary">{document.fileFormat} · {document.type} · {document.uploadDate}</p>
              </div>
              <button type="button" onClick={() => onOpenDocument(document)} className="rounded-md px-3 py-2 text-xs font-medium text-forest hover:bg-eucalyptus-subtle">
                Details
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-y border-border-subtle py-6 text-sm text-text-secondary">
          {documents.length ? 'No documents match your search.' : 'No documents yet.'}
        </p>
      )}
    </div>
  );
};
