import React, { useState } from 'react';
import {
  Activity,
  Building2,
  ClipboardList,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
} from 'lucide-react';
import type { TimelineEvent, EventCategory } from '../../types/patient';

export interface MedicalHistoryTimelineProps {
  events: TimelineEvent[];
  onSelectEvent: (event: TimelineEvent) => void;
}

const CATEGORIES: ('All' | EventCategory)[] = [
  'All',
  'Diagnosis',
  'Consultation',
  'Prescription',
  'Medication Change',
  'Lab Investigation',
  'Imaging Report',
  'Hospital Admission',
  'Discharge',
];

const CATEGORY_ICON: Record<EventCategory, React.ComponentType<{ size?: number }>> = {
  Diagnosis: Activity,
  Consultation: Stethoscope,
  Prescription: Pill,
  'Medication Change': Pill,
  'Lab Investigation': FlaskConical,
  'Imaging Report': FileText,
  'Hospital Admission': Building2,
  Discharge: ClipboardList,
};

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
};

export const MedicalHistoryTimeline: React.FC<MedicalHistoryTimelineProps> = ({
  events,
  onSelectEvent,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | EventCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const query = searchQuery.trim().toLowerCase();
  const filteredEvents = events.filter((event) => (
    (selectedCategory === 'All' || event.category === selectedCategory) &&
    (!query || `${event.title} ${event.description} ${event.facility} ${event.doctor}`.toLowerCase().includes(query))
  ));

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="border-b border-border-subtle pb-6">
        <p className="mb-2 text-sm text-text-secondary">Your health record</p>
        <h1 className="font-heading text-3xl font-semibold text-forest">Medical history</h1>
      </header>

      <section aria-label="Timeline filters" className="space-y-3">
        <label className="block">
          <span className="sr-only">Search timeline</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search events"
            className="w-full max-w-sm rounded-lg border border-border-subtle bg-white px-3.5 py-2.5 text-sm focus:border-forest focus:outline-none"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((category) => (
            <button
              type="button"
              key={category}
              aria-pressed={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
                selectedCategory === category
                  ? 'bg-forest text-white'
                  : 'bg-white text-text-secondary hover:bg-eucalyptus-subtle'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {filteredEvents.length ? (
        <ol className="ml-3 border-l border-border-medium">
          {filteredEvents.map((event) => {
            const Icon = CATEGORY_ICON[event.category];
            return (
              <li key={event.id} className="relative pb-7 pl-7 last:pb-0">
                <span className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle bg-white text-forest">
                  <Icon size={15} />
                </span>
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="group w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
                >
                  <time className="text-xs text-text-muted">{formatDate(event.date)}</time>
                  <h2 className="mt-1 font-heading text-sm font-semibold text-text-main group-hover:text-forest">
                    {event.title}
                  </h2>
                  <p className="mt-1 line-clamp-1 text-sm text-text-secondary">{event.description}</p>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="border-y border-border-subtle py-8 text-center">
          <Activity size={20} className="mx-auto text-eucalyptus-dark" />
          <p className="mt-3 text-sm font-medium text-text-main">
            {events.length ? 'No entries match these filters.' : 'Your timeline is empty.'}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {events.length ? 'Try another category or search.' : 'Timeline entries will appear here when available.'}
          </p>
        </div>
      )}
    </div>
  );
};
