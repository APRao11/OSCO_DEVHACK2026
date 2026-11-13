import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, LoaderCircle, ShieldCheck, Stethoscope } from 'lucide-react';
import { getAuthToken } from '../../auth/patientStorage';
import {
  approveAccessRequest,
  denyAccessRequest,
  endAccessSession,
  listAccessRequests,
  type PatientAccessRequest,
} from '../../api/queries.js';

const POLL_MS = 5000;
const LEVEL_TEXT = { read: 'view your records', edit: 'view and correct your records' } as const;

const minutesLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Access requests and access history on the patient's dashboard (MVP document 6.1.8).
 * A doctor sees nothing until the patient approves here; the patient chooses the
 * level (view, or view and correct), can end access at any time, and sees past decisions.
 */
export const AccessRequestsPanel: React.FC = () => {
  const [requests, setRequests] = useState<PatientAccessRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const { data } = await listAccessRequests(token);
      setRequests(data.requests);
    } catch {
      // Keep the last list; a later poll retries.
    }
  }, []);

  // New requests appear while the dashboard is open (5.6: "checks for new requests every few seconds").
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    let active = true;
    const poll = () =>
      listAccessRequests(token)
        .then(({ data }) => {
          if (active) setRequests(data.requests);
        })
        .catch(() => {});
    void poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const act = async (key: string, action: (token: string) => Promise<unknown>) => {
    const token = getAuthToken();
    if (!token) return;
    setBusy(key);
    setError('');
    try {
      await action(token);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'That did not work. Try again.');
    } finally {
      setBusy(null);
    }
  };

  if (requests === null) return null;
  const pending = requests.filter((r) => r.status === 'pending');
  const active = requests.filter((r) => r.status === 'active');
  const past = requests.filter((r) => r.status !== 'pending' && r.status !== 'active').slice(0, 5);
  if (!requests.length) {
    return (
      <section aria-labelledby="access-heading" className="rounded-xl border border-border-subtle bg-white p-5">
        <h2 id="access-heading" className="font-heading text-lg font-semibold text-text-main">Doctor access</h2>
        <p className="mt-1 text-sm text-text-secondary">No doctor has asked to see your records. Requests appear here for you to approve or deny.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="access-heading" className="space-y-4 rounded-xl border border-border-subtle bg-white p-5">
      <h2 id="access-heading" className="font-heading text-lg font-semibold text-text-main">
        Doctor access {pending.length > 0 && <span className="ml-1 rounded-full bg-citron px-2 py-0.5 text-xs font-semibold text-forest">{pending.length} waiting</span>}
      </h2>

      {pending.map((r) => (
        <div key={r.id} className="rounded-lg border border-citron bg-citron-subtle p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-main">
            <Stethoscope size={16} className="text-forest" />
            <span className="font-semibold">{r.doctor.name}</span>
            {r.doctor.verified && (
              <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-forest">
                <BadgeCheck size={12} /> Verified doctor
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Wants to <span className="font-medium text-text-main">{LEVEL_TEXT[r.requestedAccess]}</span> for 60 minutes. Reason: {r.purpose}
          </p>
          {r.requestedAccess === 'edit' && (
            <p className="mt-1 text-xs text-text-secondary">Any correction is saved under the doctor’s name, and the original stays visible to you.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(r.id, (t) => approveAccessRequest(t, r.id, r.requestedAccess))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest-dark disabled:opacity-60"
            >
              {busy === r.id && <LoaderCircle size={14} className="animate-spin" />}
              {r.requestedAccess === 'edit' ? 'Allow view and correct' : 'Approve'}
            </button>
            {r.requestedAccess === 'edit' && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(`${r.id}-read`, (t) => approveAccessRequest(t, r.id, 'read'))}
                className="rounded-lg border border-forest px-3 py-2 text-sm font-semibold text-forest hover:bg-eucalyptus-subtle disabled:opacity-60"
              >
                Allow view only
              </button>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void act(`${r.id}-deny`, (t) => denyAccessRequest(t, r.id))}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-warning hover:bg-warning-subtle disabled:opacity-60"
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      {active.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle p-4">
          <p className="flex items-center gap-2 text-sm text-text-main">
            <ShieldCheck size={16} className="text-forest" />
            <span>
              <span className="font-semibold">{r.doctor.name}</span> can {LEVEL_TEXT[r.session!.accessLevel]} ·{' '}
              <span className="font-mono text-xs">{minutesLeft(r.session!.expiresAt)} min left</span>
            </span>
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void act(`${r.id}-end`, (t) => endAccessSession(t, r.session!.id))}
            className="rounded-lg border border-warning px-3 py-1.5 text-sm font-semibold text-warning hover:bg-warning-subtle disabled:opacity-60"
          >
            End access
          </button>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-text-secondary">Access history</summary>
          <ul className="mt-2 divide-y divide-border-subtle text-sm">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2 text-text-secondary">
                <span>
                  {r.doctor.name} · {r.purpose} · {r.approvedAccess ? LEVEL_TEXT[r.approvedAccess] : LEVEL_TEXT[r.requestedAccess]}
                </span>
                <span className="font-mono text-xs">
                  {r.status} · {when(r.decidedAt ?? r.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
