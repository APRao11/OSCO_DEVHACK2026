import { useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, CircleX, Clock, LoaderCircle, Lock, Search } from 'lucide-react';
import {
  ACCESS_STORE_KEY,
  ACCESS_WINDOW_MINUTES,
  cancelAccessRequest,
  DEMO_PATIENT_ID,
  decideDemoRequest,
  getAccessRequest,
  listMyAccessRequests,
  submitAccessRequest,
} from '../../api/doctorAccess';

const POLL_MS = 3000;
const REASONS = ['Consultation', 'Emergency care', 'Follow-up', 'Second opinion'];

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/**
 * Find a patient and request access (MVP document 6.2.2, 5.6).
 *
 * Entering a Patient ID submits an access request with a reason. The page then
 * waits, checking every few seconds, and only moves on once the patient has
 * approved. Before approval the doctor sees limited identification only.
 *
 * @param {{ onApproved: (request: object) => void }} props
 */
export default function FindPatient({ onApproved }) {
  const inputId = useId();
  const reasonId = useId();
  const [patientId, setPatientId] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  // 'read' = view records, 'edit' = view and correct. The patient may grant less than asked.
  const [access, setAccess] = useState('read');
  const [phase, setPhase] = useState('idle'); // idle | submitting | waiting | approved | denied | expired
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const onApprovedRef = useRef(onApproved);
  useEffect(() => {
    onApprovedRef.current = onApproved;
  }, [onApproved]);
  const requestId = request?.id;
  const requestDemo = request?.demo ?? false;
  // This doctor's recent requests from the server, so nothing is lost on a reload or portal switch.
  const [recent, setRecent] = useState([]);
  const [ignored, setIgnored] = useState(() => new Set());

  useEffect(() => {
    if (phase !== 'idle') return undefined;
    let active = true;
    listMyAccessRequests()
      .then((list) => {
        if (!active) return;
        setRecent(list);
        // Pick up a request that is still waiting for the patient (unless the doctor stopped waiting on it).
        const pending = list.find((r) => r.status === 'pending' && !ignored.has(r.id));
        if (pending) {
          setRequest(pending);
          setPhase('waiting');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [phase, ignored]);

  // Patients who approved and whose access has not expired: one entry per patient, the widest and latest access.
  const activeAccess = Object.values(
    recent
      .filter((r) => r.status === 'approved' && r.accessExpiresAt && new Date(r.accessExpiresAt).getTime() > Date.now())
      .reduce((byPatient, r) => {
        const best = byPatient[r.patientId];
        const better = !best || (r.accessLevel === 'edit' && best.accessLevel !== 'edit') || (r.accessLevel === best.accessLevel && r.accessExpiresAt > best.accessExpiresAt);
        return better ? { ...byPatient, [r.patientId]: r } : byPatient;
      }, {}),
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!patientId.trim()) {
      setError('Enter a Patient ID.');
      return;
    }
    setError('');
    setPhase('submitting');
    try {
      const created = await submitAccessRequest({ patientId, reason, access });
      setRequest(created);
      setPhase('waiting');
    } catch (submitError) {
      setError(submitError.message || 'The request could not be sent. Try again.');
      setPhase('idle');
    }
  };

  // Wait for the patient's decision: poll, and also react to other tabs updating the store.
  useEffect(() => {
    if (phase !== 'waiting' || !requestId) return undefined;
    let active = true;
    const check = async () => {
      try {
        const latest = await getAccessRequest(requestId, { demo: requestDemo });
        if (!active) return;
        setRequest(latest);
        if (latest.status !== 'pending') setPhase(latest.status);
      } catch (checkError) {
        if (active) {
          setError(checkError.message);
          setPhase('idle');
        }
      }
    };
    const timer = setInterval(check, POLL_MS);
    const onStorage = (event) => event.key === ACCESS_STORE_KEY && check();
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [phase, requestId, requestDemo]);

  // Approved: show the confirmation briefly, then move forward.
  useEffect(() => {
    if (phase !== 'approved' || !request) return undefined;
    const timer = setTimeout(() => onApprovedRef.current(request), 900);
    return () => clearTimeout(timer);
  }, [phase, request]);

  const reset = () => {
    setPhase('idle');
    setRequest(null);
    setError('');
  };

  const cancel = async () => {
    if (request) {
      await cancelAccessRequest(request.id, { demo: request.demo });
      setIgnored((set) => new Set(set).add(request.id));
    }
    reset();
  };

  // Demo stand-in for the patient's decision; the polling picks it up.
  const simulate = async (decision) => {
    if (!request) return;
    await decideDemoRequest(request.id, decision);
  };

  return (
    <div className="brief-fade-in rounded-[28px] bg-bone p-4 font-inter text-aubergine sm:p-8 lg:p-12">
      <div className="mx-auto max-w-xl">
        <p className="font-jetbrains text-[11px] uppercase tracking-[0.16em] text-ink-muted">Doctor portal</p>
        <h1 className="mt-2 font-fraunces text-[40px] font-medium leading-tight tracking-tight sm:text-[48px]">Find patient</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Enter the patient's ID to request access. No record is shown until the patient approves on their dashboard. Access lasts{' '}
          {ACCESS_WINDOW_MINUTES} minutes, at the level the patient grants.
        </p>

        {(phase === 'idle' || phase === 'submitting') && activeAccess.length > 0 && (
          <section className="mt-8 rounded-3xl bg-sage p-5 sm:p-6" aria-labelledby="active-access-heading">
            <h2 id="active-access-heading" className="text-sm font-semibold">
              Active access
            </h2>
            <p className="mt-0.5 text-xs text-aubergine/70">These patients approved your request. Open a record while the access lasts.</p>
            <ul className="mt-3 space-y-2">
              {activeAccess.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.patient.name}</p>
                    <p className="text-xs text-ink-muted">
                      <span className="font-jetbrains">{r.patientId}</span> · {r.accessLevel === 'edit' ? 'View and correct' : 'View only'} ·{' '}
                      <span className="font-jetbrains">{Math.max(0, Math.ceil((new Date(r.accessExpiresAt).getTime() - Date.now()) / 60_000))} min</span> left
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApprovedRef.current(r)}
                    className="rounded-full bg-aubergine px-4 py-2 text-sm font-semibold text-white hover:bg-aubergine-raised"
                  >
                    Open record
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(phase === 'idle' || phase === 'submitting') && (
          <form onSubmit={submit} className="mt-8 rounded-3xl bg-chalk p-5 sm:p-6" noValidate>
            <label htmlFor={inputId} className="mb-2 block text-sm font-semibold">
              Enter Patient ID
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-white px-3 focus-within:border-aubergine">
              <Search size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
              <input
                id={inputId}
                value={patientId}
                onChange={(event) => {
                  setPatientId(event.target.value);
                  if (error) setError('');
                }}
                placeholder="OSCO-XXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
                className="min-w-0 flex-1 bg-transparent py-3 font-jetbrains text-[15px] tracking-wide outline-none placeholder:text-ink-muted/60"
              />
            </div>
            <p id={`${inputId}-hint`} className="mt-2 text-xs text-ink-muted">
              The patient's ID is on their dashboard (OSCO-…). Sample report: <span className="font-jetbrains">{DEMO_PATIENT_ID}</span>
            </p>

            <label htmlFor={reasonId} className="mb-2 mt-5 block text-sm font-semibold">
              Reason for access
            </label>
            <select
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-2xl border border-hairline bg-white px-3 py-3 text-sm outline-none focus:border-aubergine"
            >
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>

            <fieldset className="mt-5">
              <legend className="mb-2 text-sm font-semibold">Access needed</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: 'read', title: 'View records', hint: 'Read the medical history and documents.' },
                  { value: 'edit', title: 'View and correct', hint: 'Also correct or delete wrong entries. Every change is recorded under your name.' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-2xl border p-3 text-sm ${access === option.value ? 'border-aubergine bg-white' : 'border-hairline bg-white/60 hover:border-aubergine/40'}`}
                  >
                    <input type="radio" name="access" value={option.value} checked={access === option.value} onChange={() => setAccess(option.value)} className="sr-only" />
                    <span className="block font-semibold">{option.title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{option.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p id={`${inputId}-error`} role="alert" className="mt-4 rounded-xl bg-brick-soft px-3 py-2 text-sm text-brick">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting'}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-aubergine px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-aubergine-raised disabled:opacity-70"
            >
              {phase === 'submitting' && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
              {phase === 'submitting' ? 'Sending request…' : 'Request access'}
            </button>
          </form>
        )}

        {request && phase !== 'idle' && phase !== 'submitting' && (
          <section className="mt-8 rounded-3xl bg-chalk p-5 sm:p-6" aria-live="polite">
            {/* Limited identification only: name and age, no medical data. */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-4">
              <div>
                <p className="text-lg font-semibold">{request.patient.name}</p>
                <p className="text-sm text-ink-muted">
                  {[request.patient.age, request.patient.sex].filter(Boolean).join(' · ')}
                  {request.patient.age ? ' · ' : ''}
                  <span className="font-jetbrains text-[12.5px]">{request.patientId}</span>
                </p>
              </div>
              <p className="text-xs text-ink-muted">
                Reason: <span className="font-medium text-aubergine">{request.reason}</span> · sent{' '}
                <span className="font-jetbrains">{timeOf(request.requestedAt)}</span>
              </p>
            </div>

            {phase === 'waiting' && (
              <>
                <div className="flex items-start gap-3 pt-5">
                  <Clock size={20} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Waiting for {request.patient.name} to approve</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      The request is on the patient's dashboard. This page checks every few seconds and opens the record once it is approved.
                    </p>
                    <p className="mt-3 inline-flex items-center gap-2 text-xs text-ink-muted">
                      <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Status: Pending
                    </p>
                  </div>
                </div>
                <button type="button" onClick={cancel} className="mt-5 text-sm font-medium text-ink-muted underline-offset-2 hover:text-aubergine hover:underline">
                  {request.demo ? 'Withdraw request' : 'Stop waiting'}
                </button>

                {request.demo && (
                <div className="mt-6 rounded-2xl border border-dashed border-aubergine/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Demo only</p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    This is the sample patient, with no real account. Use these to stand in for their decision.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => simulate('approve')} className="rounded-full border border-moss px-3.5 py-1.5 text-xs font-semibold text-moss hover:bg-moss/10">
                      Patient approves
                    </button>
                    <button type="button" onClick={() => simulate('deny')} className="rounded-full border border-brick px-3.5 py-1.5 text-xs font-semibold text-brick hover:bg-brick/10">
                      Patient denies
                    </button>
                  </div>
                </div>
                )}
              </>
            )}

            {phase === 'approved' && (
              <div className="flex items-start gap-3 pt-5">
                <CircleCheck size={20} className="mt-0.5 shrink-0 text-moss" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Approved</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                    <Lock size={13} aria-hidden="true" />
                    Opening the record ({request.accessLevel === 'edit' ? 'view and correct' : 'view only'}) for {ACCESS_WINDOW_MINUTES} minutes…
                  </p>
                </div>
              </div>
            )}

            {(phase === 'denied' || phase === 'expired') && (
              <div className="pt-5">
                <div className="flex items-start gap-3">
                  <CircleX size={20} className="mt-0.5 shrink-0 text-brick" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{phase === 'denied' ? 'Request denied' : 'Request expired'}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {phase === 'denied'
                        ? `${request.patient.name} did not approve access. No record has been shown.`
                        : 'The request was not answered in time. You can send a new one.'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={reset} className="mt-5 rounded-full bg-aubergine px-5 py-2.5 text-sm font-semibold text-white hover:bg-aubergine-raised">
                  New request
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
