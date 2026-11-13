import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, ChevronDown, FileImage, FileText, LoaderCircle, RotateCw, UploadCloud } from 'lucide-react';
import { getAuthToken } from '../../auth/patientStorage';
import {
  getDocumentFindings,
  listDocuments,
  retryDocument,
  uploadDocuments,
  type ExtractedFinding,
  type ProcessedDocument,
} from '../../api/queries.js';

const POLL_MS = 3000;
const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const STATUS_LABELS: Record<ProcessedDocument['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Ready',
  failed: 'Failed',
};

const STATUS_STYLES: Record<ProcessedDocument['status'], string> = {
  uploaded: 'bg-osco-bg text-text-secondary',
  processing: 'bg-citron-subtle text-forest',
  ready: 'bg-eucalyptus-subtle text-forest',
  failed: 'bg-warning-subtle text-warning',
};

const QUALIFIERS: Record<ExtractedFinding['assertion'], string | null> = {
  present: null,
  absent: 'Documented as absent',
  possible: 'Possible - unconfirmed',
  historical: 'Past history',
};

const CATEGORY_LABELS: Record<ExtractedFinding['category'], string> = {
  condition: 'Condition',
  medication: 'Medicine',
  allergy: 'Allergy',
  investigation: 'Investigation',
  event: 'Event',
};

const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Dated 23 Jul 2024", or why there is no date. Parsed by hand so time zones cannot shift the day. */
const documentDateLabel = (document: ProcessedDocument) => {
  if (document.documentDate) {
    const [y, m, d] = document.documentDate.split('-');
    const label = document.documentDatePrecision === 'year' ? y : document.documentDatePrecision === 'month' ? `${MONTHS[Number(m) - 1]} ${y}` : `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
    return `Dated ${label}`;
  }
  if (document.documentDateAlternatives?.length) return `Date unclear: "${document.documentDateText}"`;
  return 'No date found';
};

const findingDetail = (finding: ExtractedFinding) =>
  finding.category === 'medication'
    ? [finding.dose, finding.frequency].filter(Boolean).join(' ')
    : [finding.value && [finding.value, finding.unit].filter(Boolean).join(' '), finding.refRange && `(lab's range ${finding.refRange})`]
        .filter(Boolean)
        .join(' ');

/**
 * Upload and scan documents (MVP document section 6.1.4).
 * Files go to POST /api/documents; each one becomes a background job. The list
 * polls while anything is Uploaded or Processing, and a Ready document shows
 * its verified findings and how many were rejected by the Quote Verifier.
 */
export const UploadDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<{ tone: 'info' | 'warning'; text: string }[]>([]);
  const [loadError, setLoadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const { data } = await listDocuments(token);
      setDocuments(data.documents);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your documents.');
    } finally {
      setLoaded(true);
    }
  }, []);

  // First load. State is only set from the promise callbacks, and not after unmount.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    let active = true;
    listDocuments(token)
      .then(({ data }) => {
        if (active) setDocuments(data.documents);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load your documents.');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Keep checking while any document is still on its way to Ready or Failed.
  const pending = documents.some((d) => d.status === 'uploaded' || d.status === 'processing');
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [pending, refresh]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const token = getAuthToken();
    if (!token) {
      setMessages([{ tone: 'warning', text: 'Your session has ended. Log in again to upload.' }]);
      return;
    }
    const files = Array.from(fileList);
    const notes: { tone: 'info' | 'warning'; text: string }[] = [];
    const tooBig = files.filter((f) => f.size > MAX_BYTES);
    const accepted = files.filter((f) => f.size <= MAX_BYTES).slice(0, MAX_FILES);
    if (tooBig.length) notes.push({ tone: 'warning', text: `${tooBig.map((f) => f.name).join(', ')}: larger than 10 MB, not uploaded.` });
    if (files.length - tooBig.length > MAX_FILES) notes.push({ tone: 'warning', text: `Only the first ${MAX_FILES} files were uploaded. Add the rest in another batch.` });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (!accepted.length) {
      setMessages(notes);
      return;
    }

    setUploading(true);
    try {
      const { data } = await uploadDocuments(token, accepted);
      for (const result of data.results) {
        if (result.error) notes.push({ tone: 'warning', text: `${result.fileName}: ${result.error}` });
        else if (result.duplicate) notes.push({ tone: 'info', text: `${result.fileName} was already uploaded.` });
        if (result.queueError) {
          notes.push({ tone: 'warning', text: `${result.fileName} is stored, but processing could not start: ${result.queueError} Use Retry once the processing service is running.` });
        }
      }
      setMessages(notes);
      await refresh();
    } catch (error) {
      setMessages([...notes, { tone: 'warning', text: error instanceof Error ? error.message : 'Upload failed. Try again.' }]);
    } finally {
      setUploading(false);
    }
  };

  const retry = async (document: ProcessedDocument) => {
    const token = getAuthToken();
    if (!token) return;
    try {
      await retryDocument(token, document.id);
      setMessages([]);
    } catch (error) {
      setMessages([{ tone: 'warning', text: `${document.name}: ${error instanceof Error ? error.message : 'Retry failed.'}` }]);
    }
    await refresh();
  };

  const totals = documents.reduce(
    (sum, d) => ({ returned: sum.returned + (d.stats?.returned ?? 0), rejected: sum.rejected + (d.stats?.rejected ?? 0) }),
    { returned: 0, rejected: 0 },
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <p className="mb-2 text-sm text-text-secondary">Your records</p>
        <h1 className="font-heading text-3xl font-semibold text-forest">Upload documents</h1>
        <p className="mt-2 text-sm text-text-secondary">
          PDFs or photos of prescriptions, lab reports, discharge summaries and other records. Up to {MAX_FILES} at a time, 10 MB each. You can keep
          uploading while earlier ones are processed.
        </p>
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
          void handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-8 text-center transition-colors ${isDragging ? 'border-forest bg-eucalyptus-subtle' : 'border-border-medium bg-white'}`}
      >
        <input ref={fileInputRef} type="file" multiple accept="application/pdf,image/*" className="sr-only" onChange={(event) => void handleFiles(event.target.files)} />
        {/* Scan: the browser's camera option on phones, no extra library (6.1.4). */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void handleFiles(event.target.files)} />
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-eucalyptus-subtle text-forest">
          {uploading ? <LoaderCircle size={21} className="animate-spin" /> : <UploadCloud size={21} />}
        </span>
        <h2 className="mt-4 font-heading text-base font-semibold text-text-main">{uploading ? 'Uploading…' : 'Add documents'}</h2>
        <p className="mt-1 text-sm text-text-secondary">Drop files here, choose from your device, or scan with your camera.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark disabled:opacity-60"
          >
            Choose files
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-border-medium bg-white px-4 py-2.5 text-sm font-semibold text-forest hover:bg-eucalyptus-subtle disabled:opacity-60"
          >
            <Camera size={16} /> Scan
          </button>
        </div>
        {messages.length > 0 && (
          <ul role="status" className="mx-auto mt-4 max-w-xl space-y-1 text-left text-sm">
            {messages.map((m, i) => (
              <li key={i} className={m.tone === 'warning' ? 'text-warning' : 'text-text-secondary'}>
                {m.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-text-main">Documents</h2>
          {totals.returned > 0 && (
            <span className="font-mono text-[11px] text-text-secondary">
              {totals.returned} findings extracted, {totals.rejected} rejected by the quote check
            </span>
          )}
        </div>
        {loadError && <p className="mb-3 text-sm text-warning">{loadError}</p>}
        {!loaded ? (
          <p className="border-y border-border-subtle py-5 text-sm text-text-secondary">Loading your documents…</p>
        ) : documents.length ? (
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {documents.map((document) => (
              // Keyed on status so a row starts fresh (and refetches findings) when processing finishes.
              <DocumentRow key={`${document.id}:${document.status}:${document.findingsCount}`} document={document} onRetry={() => void retry(document)} />
            ))}
          </ul>
        ) : (
          <p className="border-y border-border-subtle py-5 text-sm text-text-secondary">No documents yet. Select a PDF or image to get started.</p>
        )}
      </section>
    </div>
  );
};

const DocumentRow: React.FC<{ document: ProcessedDocument; onRetry: () => void }> = ({ document, onRetry }) => {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<ExtractedFinding[] | null>(null);
  const [error, setError] = useState('');
  const isPdf = document.mimeType === 'application/pdf';
  const busy = document.status === 'uploaded' || document.status === 'processing';

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && findings === null) {
      const token = getAuthToken();
      if (!token) return;
      try {
        const { data } = await getDocumentFindings(token, document.id);
        setFindings(data.findings);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load findings.');
      }
    }
  };

  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        {isPdf ? <FileText size={18} className="shrink-0 text-forest" /> : <FileImage size={18} className="shrink-0 text-forest" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-main">{document.name}</p>
          <p className="mt-1 text-xs text-text-muted">
            {isPdf ? 'PDF' : 'Image'} · {sizeLabel(document.byteSize)}
            {document.pageCount ? ` · ${document.pageCount} page${document.pageCount === 1 ? '' : 's'}` : ''}
            {document.status === 'ready' && ` · ${documentDateLabel(document)}`}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[document.status]}`}>
          {busy && <LoaderCircle size={12} className="animate-spin" />}
          {STATUS_LABELS[document.status]}
        </span>
      </div>

      {document.status === 'ready' && document.stats && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-[30px]">
          <p className="font-mono text-[11px] text-text-secondary">
            {document.stats.returned} findings extracted · {document.stats.accepted} verified · {document.stats.rejected} rejected by the quote check
          </p>
          <button type="button" onClick={() => void toggle()} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
            {open ? 'Hide findings' : 'View findings'}
            <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {document.status === 'uploaded' && (
        <p className="mt-2 pl-[30px] text-xs text-text-secondary">Waiting for the processing service to pick this up.</p>
      )}

      {document.status === 'failed' && (
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 pl-[30px]">
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {document.error || 'Processing failed.'} The original file is kept.
          </p>
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
            <RotateCw size={13} /> Retry
          </button>
        </div>
      )}

      {document.status === 'uploaded' && (
        <div className="mt-1 pl-[30px]">
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline">
            <RotateCw size={13} /> Retry now
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 pl-[30px]">
          {error && <p className="text-sm text-warning">{error}</p>}
          {!error && findings === null && <p className="text-sm text-text-secondary">Loading findings…</p>}
          {findings && findings.length === 0 && (
            <p className="text-sm text-text-secondary">
              No findings could be verified in this document. A finding is only shown when its exact wording, and its values and units, are found in
              the document. Clearer photos give better results.
            </p>
          )}
          {findings && findings.length > 0 && (
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-white">
              {findings.map((finding) => {
                const qualifier = finding.subject !== 'patient' ? `${finding.subjectRelation ?? 'Family'} (not the patient)` : QUALIFIERS[finding.assertion];
                const detail = findingDetail(finding);
                return (
                  <li key={finding.id} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">{CATEGORY_LABELS[finding.category]}</span>
                      <span className="text-sm font-medium text-text-main">{finding.name}</span>
                      {detail && <span className="text-xs text-text-secondary">{detail}</span>}
                      {qualifier && <span className="rounded bg-osco-bg px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">{qualifier}</span>}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      “{finding.quote}” <span className="font-mono text-[10px] text-text-muted">· p.{finding.page} · AI-extracted</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};
