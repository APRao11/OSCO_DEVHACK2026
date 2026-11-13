import { useEffect, useRef, useState } from 'react';
import { FileText, History, Lock, SquarePen, TriangleAlert } from 'lucide-react';
import { getActiveAccess, isDemoPatient } from '../../api/doctorAccess';
import { EmergencyBriefReport } from './EmergencyBriefReport';
import DoctorReportTab from './DoctorReportTab';
import DoctorTimeline from './DoctorTimeline';
import DoctorAlerts from './DoctorAlerts';
import DoctorAddRecord from './DoctorAddRecord';

const TABS = {
  'emergency-brief': DoctorReportTab,
  'medical-history': DoctorTimeline,
  'review-verification': DoctorAlerts,
  'add-record': DoctorAddRecord,
};

/**
 * The four record sections. navId matches the existing sidebar items, so the
 * sidebar and this menu always show the same section.
 */
export const RECORD_SECTIONS = [
  { navId: 'emergency-brief', label: 'Report', icon: FileText },
  { navId: 'medical-history', label: 'Medical History', icon: History },
  { navId: 'review-verification', label: 'Alert and Reviews', icon: TriangleAlert },
  { navId: 'add-record', label: 'Add Changes', icon: SquarePen },
];

const minutesLeft = (access) => (access ? Math.max(0, Math.ceil((new Date(access.accessExpiresAt).getTime() - Date.now()) / 60_000)) : 0);

/**
 * Doctor's view of one patient after approval (MVP document 6.2.3).
 * Access lasts 60 minutes at the level the patient granted (view, or view and
 * correct); when it runs out or the patient ends it, the doctor goes back to
 * Find Patient and must ask again. The server checks consent on every request.
 *
 * @param {{ patient: { id: string, name: string }, activeNavId: string,
 *           onNavigate: (navId: string) => void, onAccessEnded: () => void }} props
 */
export default function PatientRecord({ patient, activeNavId, onNavigate, onAccessEnded }) {
  const [access, setAccess] = useState(() => getActiveAccess(patient.id));
  const [remaining, setRemaining] = useState(() => minutesLeft(access));
  const onAccessEndedRef = useRef(onAccessEnded);
  useEffect(() => {
    onAccessEndedRef.current = onAccessEnded;
  }, [onAccessEnded]);

  // Re-check the access window regularly; leave as soon as it has ended.
  useEffect(() => {
    const check = () => {
      const current = getActiveAccess(patient.id);
      setAccess(current);
      setRemaining(minutesLeft(current));
      if (!current) onAccessEndedRef.current();
    };
    check();
    const timer = setInterval(check, 15_000);
    return () => clearInterval(timer);
  }, [patient.id]);

  if (!access) return null;

  // The sample patient shows the mock Report; real patients come from the server.
  const demo = isDemoPatient(patient.id);
  const leave = () => onAccessEndedRef.current();

  const section = RECORD_SECTIONS.find((s) => s.navId === activeNavId) ?? RECORD_SECTIONS[0];
  const Tab = TABS[section.navId] ?? DoctorReportTab;

  return (
    <div className="space-y-4 font-inter text-aubergine">
      <div className="flex flex-col gap-3 rounded-[28px] bg-bone px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <nav aria-label="Patient record sections" className="-mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 rounded-full bg-white/70 p-1">
            {RECORD_SECTIONS.map(({ navId, label, icon: Icon }) => {
              const active = navId === section.navId;
              return (
                <li key={navId}>
                  <button
                    type="button"
                    onClick={() => onNavigate(navId)}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aubergine ${
                      active ? 'bg-aubergine text-white' : 'text-aubergine/75 hover:bg-aubergine/5 hover:text-aubergine'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="inline-flex items-center gap-2 text-xs text-ink-muted" role="status">
          <Lock size={13} aria-hidden="true" />
          {access.accessLevel === 'edit' ? 'View and correct' : 'View only'} · <span className="font-jetbrains text-aubergine">{remaining} min</span> left
        </p>
      </div>

      {demo ? (
        section.navId === 'emergency-brief' ? (
          <EmergencyBriefReport onOpenTimeline={() => onNavigate('medical-history')} onReview={() => onNavigate('review-verification')} />
        ) : (
          <SampleOnly label={section.label} />
        )
      ) : (
        <Tab key={section.navId} patient={patient} onAccessLost={leave} onNavigate={onNavigate} />
      )}
    </div>
  );
}

/** The sample patient has no real records behind it; only its Report mock-up is shown. */
function SampleOnly({ label }) {
  return (
    <section className="brief-fade-in rounded-[28px] bg-bone p-8 sm:p-12">
      <h1 className="font-fraunces text-[44px] font-medium leading-[1.05] tracking-tight sm:text-[56px]">{label}</h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-ink-muted">
        This is the sample patient, which only has a Report mock-up. Look up a real patient by their Patient ID (OSCO-…) to use this tab.
      </p>
    </section>
  );
}
