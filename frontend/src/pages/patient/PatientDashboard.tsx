import React from 'react';
import { ArrowUpRight, FileText, HeartPulse, Upload, UserRound } from 'lucide-react';
import type { PersonalHealthInfo, TimelineEvent, UploadedDocument } from '../../types/patient';
import type { PatientContext } from '../../types/navigation';
import { QRCodeCard } from '../../components/patient/QRCodeCard';
import { AccessRequestsPanel } from '../../components/patient/AccessRequestsPanel';

export interface PatientDashboardProps {
  patient: Pick<PatientContext, 'id' | 'name'> & { publicId?: string };
  healthInfo: PersonalHealthInfo;
  timelineEvents: TimelineEvent[];
  documents: UploadedDocument[];
  onNavigate: (pageId: string) => void;
  onSelectEvent: (event: TimelineEvent) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  patient,
  healthInfo,
  timelineEvents,
  documents,
  onNavigate,
  onSelectEvent,
}) => (
  <div className="mx-auto max-w-5xl space-y-9">
    <header className="flex flex-col gap-5 border-b border-border-subtle pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-sm font-medium text-text-secondary">Your patient portal</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-forest">
          Welcome, {patient.name}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">Your health information, organized in one place.</p>
      </div>
      {/* The public Patient ID only; the internal ID is never shown or encoded (6.1.1). */}
      {patient.publicId && <QRCodeCard patientId={patient.publicId} />}
    </header>

    <AccessRequestsPanel />

    <section aria-label="Patient actions" className="grid gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onNavigate('upload')}
        className="group flex min-h-44 items-center justify-between rounded-xl bg-forest p-6 text-left text-white transition-colors hover:bg-forest-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <span>
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-citron">
            <Upload size={19} />
          </span>
          <span className="block font-heading text-lg font-semibold">Upload documents</span>
          <span className="mt-1 block text-sm text-white/70">PDFs and images · {documents.length} saved</span>
        </span>
        <ArrowUpRight size={20} className="self-start text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>

      <button
        type="button"
        onClick={() => onNavigate('health-details')}
        className="group flex min-h-44 items-center justify-between rounded-xl border border-border-subtle bg-white p-6 text-left transition-colors hover:border-forest/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <span>
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-eucalyptus-subtle text-forest">
            <HeartPulse size={19} />
          </span>
          <span className="block font-heading text-lg font-semibold text-forest">Health details</span>
          <span className="mt-1 block text-sm text-text-secondary">Add or update information you provide</span>
        </span>
        <ArrowUpRight size={20} className="self-start text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
    </section>

    <section className="grid gap-8 md:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-text-main">Recent documents</h2>
          <button type="button" onClick={() => onNavigate('documents')} className="text-sm font-medium text-forest hover:underline">
            View all
          </button>
        </div>
        {documents.length ? (
          <ul className="divide-y divide-border-subtle border-y border-border-subtle">
            {documents.slice(0, 3).map((document) => (
              <li key={document.id} className="flex items-center gap-3 py-3">
                <FileText size={17} className="shrink-0 text-eucalyptus-dark" />
                <span className="min-w-0 flex-1 truncate text-sm text-text-main">{document.name}</span>
                <span className="text-xs text-text-muted">{document.fileFormat}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-y border-border-subtle py-4 text-sm text-text-secondary">
            Your uploaded documents will appear here.
          </p>
        )}
      </div>

      <div className="min-w-48 border-l border-border-subtle pl-6">
        <div className="flex items-center gap-2">
          <UserRound size={15} className="text-eucalyptus-dark" />
          <h2 className="font-heading text-sm font-semibold text-text-main">Patient-provided</h2>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          {healthInfo.bloodGroup || healthInfo.height || healthInfo.weight || healthInfo.allergies.length || healthInfo.conditions.length || healthInfo.otherNotes
            ? 'Health details have been added.'
            : 'No health details added yet.'}
        </p>
        <button type="button" onClick={() => onNavigate('health-details')} className="mt-3 text-xs font-medium text-forest hover:underline">
          Review details
        </button>
      </div>
    </section>

    <section className="border-t border-border-subtle pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-main">Medical history</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {timelineEvents.length ? `${timelineEvents.length} timeline entries` : 'Your timeline is empty.'}
          </p>
        </div>
        <button type="button" onClick={() => onNavigate('medical-history')} className="text-sm font-medium text-forest hover:underline">
          Open timeline
        </button>
      </div>
      {timelineEvents.slice(0, 2).map((event) => (
        <button
          type="button"
          key={event.id}
          onClick={() => onSelectEvent(event)}
          className="mt-4 block w-full border-l-2 border-eucalyptus pl-4 text-left"
        >
          <span className="block text-xs text-text-muted">{event.date}</span>
          <span className="mt-1 block text-sm font-medium text-text-main">{event.title}</span>
          <span className="mt-1 block truncate text-xs text-text-secondary">{event.description}</span>
        </button>
      ))}
    </section>
  </div>
);
