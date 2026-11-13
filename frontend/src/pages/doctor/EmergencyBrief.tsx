import React from 'react';
import {
  Activity,
  AlertTriangle,
  FileSearch,
  FileText,
  HelpCircle,
  Pill,
  ShieldAlert,
} from 'lucide-react';
import type { PatientContext } from '../../types/navigation';
import type { PersonalHealthInfo, TimelineEvent } from '../../types/patient';
import type { ReviewItem, MissingInfoGap } from '../../types/doctor';

export interface EmergencyBriefProps {
  patient: PatientContext;
  healthInfo: PersonalHealthInfo;
  timelineEvents: TimelineEvent[];
  reviewItems: ReviewItem[];
  missingGaps: MissingInfoGap[];
  onOpenDocument: (docName: string) => void;
  onOpenTimelineEvent: (event: TimelineEvent) => void;
  onNavigateReview: () => void;
}

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const SectionHeading: React.FC<{
  number: string;
  title: string;
  icon: React.ReactNode;
  tone?: 'warning' | 'forest';
}> = ({ number, title, icon, tone = 'forest' }) => (
  <div className="mb-5 flex items-center gap-3">
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center ${
        tone === 'warning' ? 'bg-warning-subtle text-warning' : 'bg-eucalyptus-subtle text-forest'
      }`}
    >
      {icon}
    </span>
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {number}
      </span>
      <h2 className={`text-xl leading-tight ${tone === 'warning' ? 'text-warning' : 'text-forest'}`}>
        {title}
      </h2>
    </div>
  </div>
);

const EventButton: React.FC<{
  event: TimelineEvent;
  onClick: () => void;
}> = ({ event, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full border-t border-[#DCE3DD] py-3 text-left first:border-0 first:pt-0 last:pb-0"
  >
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium leading-snug text-text-main group-hover:text-forest">
        {event.title}
      </span>
      <time className="shrink-0 font-mono text-[10px] text-text-muted">
        {formatDate(event.date)}
      </time>
    </div>
    <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{event.description}</p>
    <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-forest">
      <FileText size={11} />
      {event.sourceDoc}
    </span>
  </button>
);

export const EmergencyBrief: React.FC<EmergencyBriefProps> = ({
  patient,
  healthInfo,
  timelineEvents,
  reviewItems,
  missingGaps,
  onOpenDocument,
  onOpenTimelineEvent,
  onNavigateReview,
}) => {
  const events = [...timelineEvents].sort((a, b) => b.date.localeCompare(a.date));
  const medications = events
    .filter((event) => event.medicationDetails)
    .filter(
      (event, index, medicationEvents) =>
        medicationEvents.findIndex(
          (candidate) =>
            candidate.medicationDetails?.name.toLowerCase() ===
            event.medicationDetails?.name.toLowerCase(),
        ) === index,
    )
    .slice(0, 5);
  const majorEvents = events
    .filter((event) =>
      ['Diagnosis', 'Consultation', 'Hospital Admission', 'Discharge'].includes(event.category),
    )
    .slice(0, 4);
  const investigations = events
    .filter((event) => ['Lab Investigation', 'Imaging Report'].includes(event.category))
    .slice(0, 4);
  const unresolvedContradictions = reviewItems.filter(
    (item) =>
      item.type === 'contradiction' && item.status !== 'verified' && item.status !== 'corrected',
  );
  const isNoneReported = (value: string) =>
    /^(none|none reported|no known allergies|no allergies|no known conditions|no existing conditions|no conditions)$/i.test(
      value.trim(),
    );
  const allergies = healthInfo.allergies.filter((allergy) => allergy.trim() && !isNoneReported(allergy));
  const conditions = healthInfo.conditions.filter(
    (condition) => condition.trim() && !isNoneReported(condition),
  );
  const noAllergiesReported =
    healthInfo.allergies.length > 0 && healthInfo.allergies.every(isNoneReported);
  const noConditionsReported =
    healthInfo.conditions.length > 0 && healthInfo.conditions.every(isNoneReported);
  const hasPatientHealthDetails = Boolean(
    healthInfo.bloodGroup ||
      healthInfo.height ||
      healthInfo.weight ||
      allergies.length ||
      healthInfo.conditions.length ||
      healthInfo.otherNotes,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <header className="flex flex-col gap-3 border-b border-[#D5DDD6] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-eucalyptus-dark">
            Patient record
          </p>
          <h1 className="mt-1 text-4xl leading-none text-forest sm:text-5xl">
            Emergency Brief
          </h1>
        </div>
        <div className="font-mono text-xs text-text-secondary sm:text-right">
          <p className="font-sans text-sm font-medium text-text-main">{patient.name}</p>
          <p>Patient ID · {patient.id}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-stretch gap-px border border-[#D5DDD6] bg-[#D5DDD6] lg:grid-cols-12">
        <section className="bg-[#FBF7F1] p-5 sm:p-6 lg:col-span-4">
          <SectionHeading
            number="01"
            title="Allergies"
            icon={<ShieldAlert size={16} />}
            tone="warning"
          />
          {allergies.length ? (
            <div className="divide-y divide-[#E8D8D1]">
              {allergies.map((allergy, index) => (
                <details key={`${allergy}-${index}`} className="py-2 first:pt-0 last:pb-0">
                  <summary className="cursor-pointer list-none text-sm font-medium text-text-main marker:hidden">
                    <span className="mr-2 text-warning">!</span>
                    {allergy}
                  </summary>
                  <p className="pl-4 pt-2 text-xs leading-5 text-text-secondary">
                    Patient-provided. No source document is attached to this entry.
                  </p>
                </details>
              ))}
            </div>
          ) : noAllergiesReported ? (
            <p className="text-sm text-text-secondary">None reported by patient.</p>
          ) : (
            <p className="text-sm text-text-secondary">No patient-provided allergies recorded.</p>
          )}
        </section>

        <section className="bg-[#F7F8F3] p-5 sm:p-6 lg:col-span-8">
          <SectionHeading number="02" title="Medication History" icon={<Pill size={16} />} />
          {medications.length ? (
            <div className="divide-y divide-[#DCE3DD]">
              {medications.map((event) => {
                const medication = event.medicationDetails!;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenTimelineEvent(event)}
                    className="group flex w-full flex-col gap-1 py-3 text-left first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-text-main group-hover:text-forest">
                          {medication.name}
                        </span>
                        <span
                          className={`font-mono text-[10px] uppercase ${
                            medication.isCurrentlyActive ? 'text-forest' : 'text-warning'
                          }`}
                        >
                          {medication.isCurrentlyActive ? 'Current' : 'Discontinued'}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-text-secondary">
                        {medication.dosage}
                        {medication.previousDosage
                          ? ` · changed from ${medication.previousDosage}`
                          : ''}
                        {medication.reason ? ` · ${medication.reason}` : ''}
                      </span>
                    </span>
                    <time className="shrink-0 font-mono text-[10px] text-text-muted">
                      {formatDate(event.date)}
                    </time>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No medication history is available.</p>
          )}
        </section>

        <section className="bg-[#F8F8F3] p-5 sm:p-6 lg:col-span-7">
          <SectionHeading number="03" title="Major Medical Events" icon={<Activity size={16} />} />
          {majorEvents.length ? (
            <div className="divide-y divide-[#DCE3DD]">
              {majorEvents.map((event) => (
                <EventButton
                  key={event.id}
                  event={event}
                  onClick={() => onOpenTimelineEvent(event)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No medical events are available.</p>
          )}
          {conditions.length > 0 || noConditionsReported ? (
            <div className="mt-4 border-t border-[#DCE3DD] pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                Known conditions · Patient-provided
              </p>
              {conditions.length ? (
                <ul className="space-y-1 text-xs text-text-main">
                  {conditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">None reported by patient.</p>
              )}
            </div>
          ) : null}
        </section>

        <section className="bg-[#F0F5F1] p-5 sm:p-6 lg:col-span-5">
          <SectionHeading number="04" title="Recent Investigations" icon={<FileSearch size={16} />} />
          {investigations.length ? (
            <div className="divide-y divide-[#D7E1DB]">
              {investigations.map((event) => (
                <EventButton
                  key={event.id}
                  event={event}
                  onClick={() => onOpenTimelineEvent(event)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No investigations are available.</p>
          )}
        </section>

        <section className="bg-[#FBF3EF] p-5 sm:p-6 lg:col-span-6">
          <SectionHeading
            number="05"
            title="Unresolved Contradictions"
            icon={<AlertTriangle size={16} />}
            tone="warning"
          />
          {unresolvedContradictions.length ? (
            <div className="divide-y divide-[#E8D8D1]">
              {unresolvedContradictions.map((item) => (
                <details key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <summary className="cursor-pointer list-none">
                    <span className="text-sm font-medium text-text-main">{item.title}</span>
                    <span className="mt-1 block line-clamp-1 text-xs text-text-secondary">
                      {item.sourceA.value} ↔ {item.sourceB?.value || 'No second source recorded'}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-3 border-l-2 border-warning/40 pl-3">
                    <p className="text-xs leading-5 text-text-secondary">{item.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => onOpenDocument(item.sourceA.docName)}
                        className="inline-flex items-center gap-1 text-forest hover:underline"
                      >
                        <FileText size={11} />
                        {item.sourceA.docName} · p.{item.sourceA.page}
                      </button>
                      {item.sourceB && (
                        <button
                          type="button"
                          onClick={() => onOpenDocument(item.sourceB!.docName)}
                          className="inline-flex items-center gap-1 text-forest hover:underline"
                        >
                          <FileText size={11} />
                          {item.sourceB.docName} · p.{item.sourceB.page}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateReview}
                      className="font-mono text-[10px] font-medium uppercase tracking-wide text-warning hover:underline"
                    >
                      Open review workspace
                    </button>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No unresolved contradictions recorded.</p>
          )}
        </section>

        <section className="bg-[#F5F6F1] p-5 sm:p-6 lg:col-span-6">
          <SectionHeading number="06" title="Missing Information" icon={<HelpCircle size={16} />} />
          {missingGaps.length || !hasPatientHealthDetails || healthInfo.otherNotes ? (
            <div className="divide-y divide-[#DCE3DD]">
              {!hasPatientHealthDetails && (
                <details className="py-3 first:pt-0">
                  <summary className="cursor-pointer list-none text-sm font-medium text-text-main">
                    Patient-provided health details are not available
                  </summary>
                  <p className="pt-2 text-xs leading-5 text-text-secondary">
                    Ask the patient to add or update their health details in the patient portal.
                  </p>
                </details>
              )}
              {missingGaps.map((gap) => (
                <details key={gap.id} className="py-3 first:pt-0 last:pb-0">
                  <summary className="cursor-pointer list-none">
                    <span className="text-sm font-medium text-text-main">{gap.title}</span>
                    <span className="mt-1 block font-mono text-[10px] text-eucalyptus-dark">
                      {gap.timeframe}
                    </span>
                  </summary>
                  <div className="mt-2 space-y-1 text-xs leading-5 text-text-secondary">
                    <p>{gap.clinicalRelevance}</p>
                    <p>
                      <span className="font-medium text-text-main">Suggested follow-up: </span>
                      {gap.suggestedAction}
                    </p>
                  </div>
                </details>
              ))}
              {healthInfo.otherNotes && (
                <details className="py-3 last:pb-0">
                  <summary className="cursor-pointer list-none text-sm font-medium text-text-main">
                    Other patient-provided information
                  </summary>
                  <p className="pt-2 text-xs leading-5 text-text-secondary">
                    {healthInfo.otherNotes}
                  </p>
                </details>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No missing information has been flagged.</p>
          )}
        </section>
      </div>
    </div>
  );
};
