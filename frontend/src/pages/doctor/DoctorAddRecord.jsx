import { useId, useState } from 'react';
import { CheckCircle2, ClipboardList, FilePlus2, FlaskConical, LoaderCircle, Lock, NotebookPen, Pill as PillIcon, Plus, Stethoscope, X } from 'lucide-react';
import { useDoctorRecords } from './useDoctorRecords';
import { addClinicalRecord } from '../../api/doctorApi.js';
import { getDoctorProfile } from '../../auth/doctorSession';
import { BriefCard } from '../../components/brief/BriefCard';
import { BigStat } from '../../components/brief/BigStat';
import { AccessPill, DoctorPageShell, EmptyNote, Pill, TabStatus } from '../../components/brief/DoctorPageShell';
import { formatRecordDate } from '../../records/format';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'possible', label: 'Possible, unconfirmed' },
  { value: 'historical', label: 'Past history' },
  { value: 'absent', label: 'Ruled out / absent' },
];
const ACTIONS = [
  { value: 'start', label: 'Start' },
  { value: 'continue', label: 'Continue' },
  { value: 'change', label: 'Change dose' },
  { value: 'stop', label: 'Stop' },
];
const EMPTY = {
  diagnosis: { name: '', status: 'present' },
  prescription: { name: '', dose: '', frequency: '', action: 'start' },
  investigation: { name: '', value: '', unit: '', refRange: '' },
};

const field = 'w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-aubergine outline-none placeholder:text-ink-muted/60 focus:border-aubergine';
const label = 'mb-1 block font-inter text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted';

/**
 * Add Changes tab (MVP document 6.2.8): the doctor adds a clinical record with
 * diagnoses, prescriptions, investigations and observations. It is saved as a
 * doctor-entered record under the doctor's name, dated to the consultation; it
 * joins the timeline and nothing earlier is changed. Needs "view and correct" consent.
 */
export default function DoctorAddRecord({ patient, onAccessLost, onNavigate }) {
  const { state, reload } = useDoctorRecords(patient.id, onAccessLost);
  const doctor = getDoctorProfile();
  const [form, setForm] = useState(() => ({ consultationDate: today(), facility: '', observations: '', diagnoses: [{ ...EMPTY.diagnosis }], prescriptions: [], investigations: [] }));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  if (state.status !== 'ready') return <TabStatus title="Add Changes" state={state} />;
  const { records, access } = state;
  const canEdit = access.level === 'edit';

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setRow = (list, index, patch) => setForm((f) => ({ ...f, [list]: f[list].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  const addRow = (list, kind) => setForm((f) => ({ ...f, [list]: [...f[list], { ...EMPTY[kind] }] }));
  const removeRow = (list, index) => setForm((f) => ({ ...f, [list]: f[list].filter((_, i) => i !== index) }));

  // Rows with nothing typed are ignored; a row with details but no name is an error.
  const filled = (row) => Object.entries(row).some(([k, v]) => !['status', 'action'].includes(k) && String(v).trim());
  const diagnoses = form.diagnoses.filter(filled);
  const prescriptions = form.prescriptions.filter(filled);
  const investigations = form.investigations.filter(filled);
  const itemCount = diagnoses.length + prescriptions.length + investigations.length;

  const validate = () => {
    const problems = [];
    if (!form.consultationDate) problems.push('Choose the consultation date.');
    else if (form.consultationDate > today()) problems.push('The consultation date cannot be in the future.');
    if (diagnoses.some((d) => !d.name.trim())) problems.push('Every diagnosis needs a name.');
    if (prescriptions.some((p) => !p.name.trim())) problems.push('Every prescription needs a medicine name.');
    if (investigations.some((t) => !t.name.trim())) problems.push('Every investigation needs a test name.');
    if (!itemCount && !form.observations.trim()) problems.push('Add at least one diagnosis, prescription, investigation or observation.');
    return problems;
  };

  const submit = async (event) => {
    event.preventDefault();
    const problems = validate();
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const trim = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]).filter(([, v]) => v !== ''));
      const { data } = await addClinicalRecord(patient.id, {
        consultationDate: form.consultationDate,
        facility: form.facility.trim() || undefined,
        observations: form.observations.trim() || undefined,
        diagnoses: diagnoses.map(trim),
        prescriptions: prescriptions.map(trim),
        investigations: investigations.map(trim),
      });
      setSaved({ count: data.record.findings.length, date: form.consultationDate });
      reload();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'The record could not be saved. Try again.']);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm({ consultationDate: today(), facility: '', observations: '', diagnoses: [{ ...EMPTY.diagnosis }], prescriptions: [], investigations: [] });
    setErrors([]);
    setSaved(null);
  };

  const shell = (children) => (
    <DoctorPageShell
      title="Add Changes"
      patient={{ name: records.patientName || patient.name, publicId: records.patientId || patient.id }}
      meta={[<span key="t">New clinical record</span>]}
      aside={
        <>
          <AccessPill level={access.level} />
          <p className="text-xs text-ink-muted">Saved under your name as a doctor-entered record. Nothing earlier is changed.</p>
        </>
      }
    >
      {children}
    </DoctorPageShell>
  );

  if (!canEdit) {
    return shell(
      <div className="rounded-3xl bg-chalk p-6 sm:p-8">
        <Lock size={22} className="text-slate" aria-hidden="true" />
        <h2 className="mt-3 text-[15px] font-semibold">Adding records needs “view and correct” access</h2>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          The patient approved view-only access. Ask the patient for “view and correct” access from Find Patient to add a clinical record.
        </p>
      </div>,
    );
  }

  if (saved) {
    return shell(
      <div className="rounded-3xl bg-sage p-6 sm:p-8">
        <CheckCircle2 size={26} className="text-moss" aria-hidden="true" />
        <h2 className="mt-3 font-fraunces text-[30px] font-medium leading-tight">Record added</h2>
        <p className="mt-1 text-sm text-aubergine/80">
          Consultation on <span className="font-jetbrains">{formatRecordDate(saved.date)}</span> with {saved.count} finding{saved.count === 1 ? '' : 's'}, labelled Doctor-entered. It is in the
          patient’s timeline and the patient can see it.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('medical-history')} className="rounded-full bg-aubergine px-5 py-2.5 text-sm font-semibold text-white hover:bg-aubergine-raised">
            View in Medical History
          </button>
          <button type="button" onClick={reset} className="rounded-full border border-aubergine/30 px-5 py-2.5 text-sm font-semibold text-aubergine hover:bg-white/50">
            Add another record
          </button>
        </div>
      </div>,
    );
  }

  return shell(
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-8">
        <BriefCard title="Consultation" icon={Stethoscope}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              {(id) => <input id={id} type="date" max={today()} value={form.consultationDate} onChange={(e) => set('consultationDate', e.target.value)} className={`${field} font-jetbrains`} />}
            </Field>
            <Field label="Facility">
              {(id) => <input id={id} value={form.facility} onChange={(e) => set('facility', e.target.value)} maxLength={200} placeholder="e.g. City Clinic" className={field} />}
            </Field>
            <Field label="Doctor">
              {(id) => <input id={id} value={doctor?.name ?? ''} readOnly className={`${field} bg-bone text-ink-muted`} />}
            </Field>
          </div>
        </BriefCard>

        <BriefCard title="Diagnoses" icon={ClipboardList}>
          <Rows
            rows={form.diagnoses}
            empty="No diagnosis added."
            onRemove={(i) => removeRow('diagnoses', i)}
            render={(row, i) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <Field label="Diagnosis">{(id) => <input id={id} value={row.name} onChange={(e) => setRow('diagnoses', i, { name: e.target.value })} maxLength={200} placeholder="e.g. Essential hypertension" className={field} />}</Field>
                <Field label="Status">
                  {(id) => (
                    <select id={id} value={row.status} onChange={(e) => setRow('diagnoses', i, { status: e.target.value })} className={field}>
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
          />
          <AddButton onClick={() => addRow('diagnoses', 'diagnosis')}>Add diagnosis</AddButton>
        </BriefCard>

        <BriefCard title="Prescriptions" icon={PillIcon}>
          <Rows
            rows={form.prescriptions}
            empty="No prescription added."
            onRemove={(i) => removeRow('prescriptions', i)}
            render={(row, i) => (
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_150px]">
                <Field label="Medicine">{(id) => <input id={id} value={row.name} onChange={(e) => setRow('prescriptions', i, { name: e.target.value })} maxLength={200} placeholder="e.g. Amlodipine" className={field} />}</Field>
                <Field label="Dose">{(id) => <input id={id} value={row.dose} onChange={(e) => setRow('prescriptions', i, { dose: e.target.value })} maxLength={200} placeholder="5 mg" className={`${field} font-jetbrains`} />}</Field>
                <Field label="How often">{(id) => <input id={id} value={row.frequency} onChange={(e) => setRow('prescriptions', i, { frequency: e.target.value })} maxLength={200} placeholder="once daily" className={field} />}</Field>
                <Field label="Action">
                  {(id) => (
                    <select id={id} value={row.action} onChange={(e) => setRow('prescriptions', i, { action: e.target.value })} className={field}>
                      {ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
          />
          <AddButton onClick={() => addRow('prescriptions', 'prescription')}>Add prescription</AddButton>
        </BriefCard>

        <BriefCard title="Investigations" icon={FlaskConical}>
          <Rows
            rows={form.investigations}
            empty="No investigation added."
            onRemove={(i) => removeRow('investigations', i)}
            render={(row, i) => (
              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <Field label="Test">{(id) => <input id={id} value={row.name} onChange={(e) => setRow('investigations', i, { name: e.target.value })} maxLength={200} placeholder="e.g. HbA1c" className={field} />}</Field>
                <Field label="Result">{(id) => <input id={id} value={row.value} onChange={(e) => setRow('investigations', i, { value: e.target.value })} maxLength={200} placeholder="7.1" className={`${field} font-jetbrains`} />}</Field>
                <Field label="Unit">{(id) => <input id={id} value={row.unit} onChange={(e) => setRow('investigations', i, { unit: e.target.value })} maxLength={200} placeholder="%" className={`${field} font-jetbrains`} />}</Field>
                <Field label="Lab range">{(id) => <input id={id} value={row.refRange} onChange={(e) => setRow('investigations', i, { refRange: e.target.value })} maxLength={200} placeholder="4.0–5.6" className={`${field} font-jetbrains`} />}</Field>
              </div>
            )}
          />
          <AddButton onClick={() => addRow('investigations', 'investigation')}>Add investigation</AddButton>
        </BriefCard>

        <BriefCard title="Observations" icon={NotebookPen}>
          <Field label="Clinical observations">
            {(id) => (
              <textarea id={id} value={form.observations} onChange={(e) => set('observations', e.target.value)} maxLength={4000} rows={5} placeholder="What you observed at this consultation." className={`${field} leading-6`} />
            )}
          </Field>
          <p className="mt-1 text-right font-jetbrains text-[10.5px] text-ink-muted">{form.observations.length}/4000</p>
        </BriefCard>
      </div>

      {/* Summary: what will be saved, then save. */}
      <div className="lg:col-span-4">
        <BriefCard title="Summary" icon={FilePlus2} tone="dark" className="border-l-4 border-apricot lg:sticky lg:top-4">
          <BigStat value={itemCount} unit={`finding${itemCount === 1 ? '' : 's'} to add`} valueClassName="text-apricot" unitClassName="text-white/60" />
          <p className="mt-1 text-xs text-white/60">
            Consultation <span className="font-jetbrains">{form.consultationDate ? formatRecordDate(form.consultationDate) : '—'}</span>
            {form.facility.trim() && ` · ${form.facility.trim()}`}
          </p>
          <div className="mt-4 space-y-3">
            {itemCount === 0 && !form.observations.trim() ? (
              <EmptyNote onDark>Nothing to save yet. Add a diagnosis, prescription, investigation or observation.</EmptyNote>
            ) : (
              <>
                <SummaryGroup title="Diagnoses" items={diagnoses.map((d) => [d.name || 'Unnamed', STATUSES.find((s) => s.value === d.status)?.label])} />
                <SummaryGroup title="Prescriptions" items={prescriptions.map((p) => [p.name || 'Unnamed', [ACTIONS.find((a) => a.value === p.action)?.label, p.dose, p.frequency].filter(Boolean).join(' · ')])} />
                <SummaryGroup title="Investigations" items={investigations.map((t) => [t.name || 'Unnamed', [t.value, t.unit].filter(Boolean).join(' ')])} />
                {form.observations.trim() && <SummaryGroup title="Observations" items={[[`${form.observations.trim().slice(0, 80)}${form.observations.trim().length > 80 ? '…' : ''}`, null]]} />}
              </>
            )}
          </div>
          {errors.length > 0 && (
            <ul role="alert" className="mt-4 space-y-1 rounded-xl bg-brick/25 p-3 text-[13px] text-white">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-apricot px-5 py-3 text-sm font-semibold text-aubergine transition hover:brightness-95 disabled:opacity-60"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            Save clinical record
          </button>
          <p className="mt-3 text-[11px] leading-4 text-white/55">
            Each item is saved as a doctor-entered finding, labelled with your name and the date, and added to the timeline. Records cannot be edited afterwards; add a new record instead.
          </p>
        </BriefCard>
      </div>
    </form>,
  );
}

function Field({ label: text, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children(id)}
    </div>
  );
}

function Rows({ rows, render, onRemove, empty }) {
  if (!rows.length) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={i} className="flex items-start gap-2 rounded-2xl bg-bone/70 p-3">
          <div className="min-w-0 flex-1">{render(row, i)}</div>
          <button type="button" onClick={() => onRemove(i)} aria-label="Remove row" className="mt-5 rounded-full p-1.5 text-ink-muted hover:bg-white hover:text-brick">
            <X size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-aubergine/25 px-3.5 py-1.5 text-[13px] font-semibold text-aubergine hover:bg-aubergine/5">
      <Plus size={14} /> {children}
    </button>
  );
}

function SummaryGroup({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 font-inter text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/50">{title}</p>
      <ul className="space-y-1">
        {items.map(([name, detail], i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 text-[13px] text-white/90">
            <span className="font-medium">{name}</span>
            {detail && <Pill onDark>{detail}</Pill>}
          </li>
        ))}
      </ul>
    </div>
  );
}
