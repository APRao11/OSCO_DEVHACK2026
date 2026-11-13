import React, { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  FileText,
  FlaskConical,
  Pill,
  ScanLine,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SearchInput } from '../../components/ui/Input';
import type { TimelineEvent, EventCategory } from '../../types/patient';

export interface DoctorMedicalHistoryProps {
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

const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  Diagnosis: Activity,
  Consultation: Stethoscope,
  Prescription: Pill,
  'Medication Change': Pill,
  'Lab Investigation': FlaskConical,
  'Imaging Report': ScanLine,
  'Hospital Admission': Building2,
  Discharge: FileText,
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export const DoctorMedicalHistory: React.FC<DoctorMedicalHistoryProps> = ({
  events,
  onSelectEvent,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | EventCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...events]
      .filter((event) => selectedCategory === 'All' || event.category === selectedCategory)
      .filter(
        (event) =>
          !query ||
          [
            event.title,
            event.description,
            event.facility,
            event.doctor,
            event.category,
          ].some((value) => value.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [events, searchQuery, selectedCategory]);

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="border-b border-[#D5DDD6] pb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-eucalyptus-dark">
          Patient record
        </p>
        <h1 className="mt-1 text-4xl leading-none text-forest sm:text-5xl">Medical History</h1>
      </header>

      <div className="space-y-4">
        <div className="max-w-md">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search events, facilities, or clinicians"
          />
        </div>
        <div
          className="flex items-center gap-2 overflow-x-auto border-b border-[#D5DDD6] pb-3"
          aria-label="Filter medical history by category"
        >
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
              className={`shrink-0 border-b-2 px-2 py-2 text-xs transition-colors ${
                selectedCategory === category
                  ? 'border-forest font-semibold text-forest'
                  : 'border-transparent text-text-secondary hover:text-text-main'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {filtered.length ? (
        <ol className="relative ml-3 border-l border-[#C7D5CE]">
          {filtered.map((event) => {
            const Icon = CATEGORY_ICONS[event.category];
            return (
              <li key={event.id} className="relative pl-8">
                <span className="absolute -left-3 top-2 flex h-6 w-6 items-center justify-center bg-[#F3F1EA] text-eucalyptus-dark">
                  <Icon size={15} strokeWidth={1.7} />
                </span>
                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="group w-full border-b border-[#DCE3DD] py-3 text-left sm:py-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm font-semibold text-text-main group-hover:text-forest sm:text-base">
                      {event.title}
                    </span>
                    <time className="shrink-0 font-mono text-[10px] text-text-muted">
                      {formatDate(event.date)}
                    </time>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
                    {event.description}
                  </p>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="border-t border-[#D5DDD6] py-6 text-sm text-text-secondary">
          {events.length ? 'No history entries match these filters.' : 'No medical history has been added.'}
        </p>
      )}
    </div>
  );
};
