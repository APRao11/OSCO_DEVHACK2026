import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Lock, ShieldCheck } from 'lucide-react';
import { doctorReviewApi, getPatientRecords } from '../../api/doctorApi.js';
import { forgetAccess } from '../../api/doctorAccess';
import { FindingsReview } from '../../components/patient/FindingsReview';
import { LazySourceViewer } from '../../components/records/LazySourceViewer';
import { EmergencyBrief } from './EmergencyBrief';
import { DOCUMENT_TYPE_LABELS, formatRecordDate } from '../../records/format';
import { sourceTargetFor } from '../../records/source';
import type { PatientContext } from '../../types/navigation';
import type { PatientRecords, SourceTarget } from '../../types/records';

type Access = { level: 'read' | 'edit'; expiresAt: string };
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: PatientRecords; access: Access };

/**
 * Load a patient's medical history as this doctor. The server checks consent on
 * every request; if access has ended or was never granted, onAccessLost runs.
 */
const useDoctorRecords = (publicId: string, onAccessLost: () => void, reloadKey = 0): LoadState => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    getPatientRecords(publicId)
      .then(({ data }) => {
        if (!active) return;
        const { access, ...records } = data;
        setState({ status: 'ready', records, access });
      })
      .catch((error: { status?: number; message?: string }) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          forgetAccess(publicId);
          onAccessLost();
          return;
        }
        setState({ status: 'error', message: error.message ?? 'Could not load the record.' });
      });
    return () => {
      active = false;
    };
    // onAccessLost is a callback from the parent; reloading on its identity would refetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId, reloadKey]);
  return state;
};

export interface DoctorRecordProps {
  patient: PatientContext;
  onAccessLost: () => void;
}

/**
 * The doctor's Medical History tab: the patient's confirmed findings, document
 * by document (latest first), with the same review component the patient uses.
 * With "view and correct" consent the doctor can edit or delete entries; each
 * change is a new version under the doctor's name, and the patient sees it.
 */
export const DoctorMedicalRecords: React.FC<DoctorRecordProps> = ({ patient, onAccessLost }) => {
  const state = useDoctorRecords(patient.id, onAccessLost);
  // Memoised so FindingsReview does not reload on every render.
  const api = useMemo(() => doctorReviewApi(patient.id), [patient.id]);

  if (state.status === 'loading') return <p className="rounded-[28px] bg-bone p-8 text-sm text-ink-muted">Loading medical history…</p>;
  if (state.status === 'error') return <p className="rounded-[28px] bg-bone p-8 text-sm text-brick">{state.message}</p>;

  const { records, access } = state;
  const canEdit = access.level === 'edit';
  const withFindings = new Set(records.findings.map((f) => f.documentId));
  const documents = records.documents
    .filter((d) => d.status === 'ready' && withFindings.has(d.id))
    .sort((a, b) => (b.documentDate ?? '').localeCompare(a.documentDate ?? '') || a.name.localeCompare(b.name));

  return (
    <div className="brief-fade-in space-y-6 rounded-[28px] bg-bone p-4 font-inter text-aubergine sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-fraunces text-[40px] font-medium leading-tight tracking-tight">Medical History</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {records.patientName} · <span className="font-jetbrains text-[12.5px]">{records.patientId}</span> · {records.findings.length} confirmed
            finding{records.findings.length === 1 ? '' : 's'} from {documents.length} document{documents.length === 1 ? '' : 's'}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-xs font-medium ${canEdit ? 'bg-sage text-aubergine' : 'bg-slate-soft text-slate'}`}
        >
          {canEdit ? <ShieldCheck size={14} /> : <Lock size={14} />}
          {canEdit ? 'Patient allowed view and correct' : 'Patient allowed view only'}
        </span>
      </header>

      {documents.length === 0 ? (
        <p className="rounded-2xl bg-chalk p-6 text-sm text-ink-muted">
          No findings are in this patient’s medical history yet. Findings appear here after the patient has reviewed and added them.
        </p>
      ) : (
        <ul className="space-y-4">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-3xl bg-chalk p-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <FileText size={16} className="text-ink-muted" aria-hidden="true" />
                  {doc.name}
                </h2>
                <p className="text-xs text-ink-muted">
                  {DOCUMENT_TYPE_LABELS[doc.documentType] ?? 'Document'} ·{' '}
                  <span className="font-jetbrains">{doc.documentDate ? formatRecordDate(doc.documentDate) : 'date not documented'}</span>
                </p>
              </div>
              <FindingsReview document={doc} api={api} viewer="doctor" canEdit={canEdit} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * The doctor's Report tab for a real patient: the six-card Emergency Brief built
 * by fixed rules from the patient's confirmed findings (records/emergencyBrief.ts),
 * with click-through to the original document.
 */
export const DoctorReport: React.FC<DoctorRecordProps & { onOpenTimeline: () => void; onNavigateReview: () => void }> = ({
  patient,
  onAccessLost,
  onOpenTimeline,
  onNavigateReview,
}) => {
  const state = useDoctorRecords(patient.id, onAccessLost);
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null);

  if (state.status === 'loading') return <p className="rounded-[28px] bg-bone p-8 text-sm text-ink-muted">Loading the brief…</p>;
  if (state.status === 'error') return <p className="rounded-[28px] bg-bone p-8 text-sm text-brick">{state.message}</p>;

  return (
    <>
      <EmergencyBrief
        patient={{ ...patient, name: state.records.patientName || patient.name, id: state.records.patientId || patient.id }}
        records={state.records}
        onOpenSource={(findingId) => setSourceTarget(sourceTargetFor(state.records, findingId))}
        onOpenTimeline={onOpenTimeline}
        onNavigateReview={onNavigateReview}
      />
      <LazySourceViewer target={sourceTarget} onClose={() => setSourceTarget(null)} />
    </>
  );
};
