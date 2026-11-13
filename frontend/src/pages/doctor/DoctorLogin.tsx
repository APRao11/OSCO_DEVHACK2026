import React, { useId, useState } from 'react';
import { LoaderCircle, LogOut, ShieldAlert } from 'lucide-react';
import { loginDoctor } from '../../api/doctorApi.js';
import { saveDoctorSession, type DoctorProfile } from '../../auth/doctorSession';
import { PasswordInput } from '../../components/ui/PasswordInput';

/** Doctor sign-in (MVP document 6.2.1). */
export const DoctorLogin: React.FC<{ onLoggedIn: (profile: DoctorProfile) => void; notice?: string }> = ({ onLoggedIn, notice }) => {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await loginDoctor({ email, password });
      saveDoctorSession(data.token, data.doctor);
      onLoggedIn(data.doctor);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-2xl border border-hairline bg-white px-3 py-3 text-sm outline-none focus:border-aubergine';
  return (
    <div className="brief-fade-in rounded-[28px] bg-bone p-4 font-inter text-aubergine sm:p-8 lg:p-12">
      <div className="mx-auto max-w-md">
        <p className="font-jetbrains text-[11px] uppercase tracking-[0.16em] text-ink-muted">Doctor portal</p>
        <h1 className="mt-2 font-fraunces text-[40px] font-medium leading-tight tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">Only doctors verified by their hospital can look up patients, and only with each patient’s approval.</p>
        {notice && (
          <p role="status" className="mt-6 rounded-2xl bg-ochre-soft px-4 py-3 text-sm text-[#7A5A16]">
            {notice}
          </p>
        )}
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl bg-chalk p-5 sm:p-6" noValidate>
          <div>
            <label htmlFor={`${id}-email`} className="mb-2 block text-sm font-semibold">Email</label>
            <input id={`${id}-email`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor={`${id}-password`} className="mb-2 block text-sm font-semibold">Password</label>
            <PasswordInput id={`${id}-password`} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-brick-soft px-3 py-2 text-sm text-brick">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-aubergine px-5 py-3 text-sm font-semibold text-white hover:bg-aubergine-raised disabled:opacity-60"
          >
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
};

/** Shown to pending, rejected or revoked doctors: they can sign in but not look up patients (5.3). */
export const DoctorStatusNotice: React.FC<{ profile: DoctorProfile; onLogout: () => void }> = ({ profile, onLogout }) => (
  <div className="rounded-[28px] bg-bone p-8 font-inter text-aubergine sm:p-12">
    <div className="mx-auto max-w-md">
      <ShieldAlert size={28} className="text-ochre" aria-hidden="true" />
      <h1 className="mt-3 font-fraunces text-[32px] font-medium leading-tight">Account {profile.verificationStatus}</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">{profile.statusMessage ?? 'Your account is not verified.'} Patient lookup is not available.</p>
      <button type="button" onClick={onLogout} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-aubergine hover:underline">
        <LogOut size={15} /> Sign out
      </button>
    </div>
  </div>
);

