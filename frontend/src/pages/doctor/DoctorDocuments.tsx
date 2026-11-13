import React, { useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { SearchInput } from '../../components/ui/Input';
import type { UploadedDocument } from '../../types/patient';

export interface DoctorDocumentsProps {
  documents: UploadedDocument[];
  onOpenDocument: (doc: UploadedDocument) => void;
}

export const DoctorDocuments: React.FC<DoctorDocumentsProps> = ({
  documents,
  onOpenDocument,
}) => {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const types = ['All', ...Array.from(new Set(documents.map((document) => document.type)))];
  const filteredDocuments = documents.filter((document) => {
    const query = search.trim().toLowerCase();
    return (
      (selectedType === 'All' || document.type === selectedType) &&
      (!query ||
        [document.name, document.type, document.fileFormat]
          .some((value) => value.toLowerCase().includes(query)))
    );
  });

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="border-b border-[#D5DDD6] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-eucalyptus-dark">
          Patient record
        </p>
        <h1 className="mt-1 text-4xl leading-none text-forest sm:text-5xl">Documents</h1>
      </header>

      <div className="space-y-4">
        <div className="max-w-md">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search document name or type"
          />
        </div>
        {types.length > 1 && (
          <div
            className="flex items-center gap-2 overflow-x-auto border-b border-[#D5DDD6] pb-3"
            aria-label="Filter documents by type"
          >
            {types.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                aria-pressed={selectedType === type}
                className={`shrink-0 border-b-2 px-2 py-2 text-xs transition-colors ${
                  selectedType === type
                    ? 'border-forest font-semibold text-forest'
                    : 'border-transparent text-text-secondary hover:text-text-main'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredDocuments.length ? (
        <ul className="divide-y divide-[#D5DDD6] border-y border-[#D5DDD6]">
          {filteredDocuments.map((document) => (
            <li
              key={document.id}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={18} className="shrink-0 text-eucalyptus-dark" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-main">{document.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-text-muted">
                    {document.type} · {document.fileFormat} · {document.relevantDate || document.uploadDate}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                <span
                  className={`font-mono text-[10px] uppercase ${
                    document.status === 'Failed' ? 'text-warning' : 'text-eucalyptus-dark'
                  }`}
                >
                  {document.status}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDocument(document)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-forest hover:underline"
                >
                  <Eye size={14} />
                  View original
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-y border-[#D5DDD6] py-6 text-sm text-text-secondary">
          {documents.length
            ? 'No documents match these filters.'
            : 'No documents have been added to this patient record.'}
        </p>
      )}
    </div>
  );
};
