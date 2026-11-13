import React, { useRef, useState } from 'react';
import { FileImage, FileText, LoaderCircle, UploadCloud } from 'lucide-react';
import type { UploadedDocument } from '../../types/patient';

export interface UploadDocumentsProps {
  documents: UploadedDocument[];
  onAddDocuments: (newDocs: UploadedDocument[]) => void;
  onUpdateDocuments: (updatedDocs: UploadedDocument[]) => void;
}

export const UploadDocuments: React.FC<UploadDocumentsProps> = ({
  documents,
  onAddDocuments,
  onUpdateDocuments,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const files = Array.from(fileList);
    const supported = files.filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|gif|webp|bmp|heic|tiff?)$/i.test(file.name),
    );
    if (supported.length !== files.length) {
      setNotice('Only PDF and image files can be added.');
    } else {
      setNotice('');
    }
    if (!supported.length) return;

    const added = supported.map((file): UploadedDocument => {
      const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const fileFormat = isPdf
        ? 'PDF'
        : extension === 'JPG' ? 'JPEG' : extension;
      return {
        id: `upl-${crypto.randomUUID()}`,
        name: file.name,
        type: isPdf ? 'PDF document' : 'Image',
        fileFormat,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toISOString().slice(0, 10),
        relevantDate: new Date().toISOString().slice(0, 10),
        status: 'Processing',
        facility: 'Patient upload',
      };
    });

    onAddDocuments(added);
    window.setTimeout(() => {
      onUpdateDocuments(added.map((document) => ({ ...document, status: 'Uploaded' })));
    }, 1400);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="mb-2 text-sm text-text-secondary">Your records</p>
        <h1 className="font-heading text-3xl font-semibold text-forest">Upload documents</h1>
        <p className="mt-2 text-sm text-text-secondary">Choose PDF files or images. Upload status is simulated for this demo.</p>
      </header>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
          isDragging ? 'border-forest bg-eucalyptus-subtle' : 'border-border-medium bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-eucalyptus-subtle text-forest">
          <UploadCloud size={21} />
        </span>
        <h2 className="mt-4 font-heading text-base font-semibold text-text-main">Add a document</h2>
        <p className="mt-1 text-sm text-text-secondary">Drop files here or choose from your device.</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark"
        >
          Choose files
        </button>
        {notice && <p role="status" className="mt-3 text-sm text-warning">{notice}</p>}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-text-main">Documents</h2>
          <span className="text-xs text-text-muted">{documents.length}</span>
        </div>
        {documents.length ? (
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {documents.map((document) => (
              <li key={document.id} className="flex items-center gap-3 py-4">
                {document.fileFormat === 'PDF'
                  ? <FileText size={18} className="shrink-0 text-forest" />
                  : <FileImage size={18} className="shrink-0 text-forest" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-main">{document.name}</p>
                  <p className="mt-1 text-xs text-text-muted">{document.fileFormat} · {document.size}</p>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 text-xs ${
                  document.status === 'Processing' ? 'text-text-secondary' : 'text-forest'
                }`}>
                  {document.status === 'Processing' && <LoaderCircle size={13} className="animate-spin" />}
                  {document.status === 'Processing' ? 'Demo processing' : 'Ready · demo'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-border-subtle py-5 text-sm text-text-secondary">
            No documents yet. Select a PDF or image to get started.
          </p>
        )}
      </section>
    </div>
  );
};
