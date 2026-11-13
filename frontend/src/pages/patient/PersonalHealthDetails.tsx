import React, { useState } from 'react';
import { Check, Pencil, Save } from 'lucide-react';
import type { PersonalHealthInfo } from '../../types/patient';

export interface PersonalHealthDetailsProps {
  healthInfo: PersonalHealthInfo;
  onSave: (updated: PersonalHealthInfo) => void;
}

export const PersonalHealthDetails: React.FC<PersonalHealthDetailsProps> = ({ healthInfo, onSave }) => {
  const [isEditing, setIsEditing] = useState(!healthInfo.lastUpdated);
  const [formData, setFormData] = useState(healthInfo);
  const [allergyText, setAllergyText] = useState(healthInfo.allergies.join(', '));
  const [conditionText, setConditionText] = useState(healthInfo.conditions.join(', '));
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = () => {
    const updated = {
      ...formData,
      allergies: allergyText.split(',').map((item) => item.trim()).filter(Boolean),
      conditions: conditionText.split(',').map((item) => item.trim()).filter(Boolean),
      lastUpdated: new Date().toISOString(),
    };
    onSave(updated);
    setFormData(updated);
    setIsEditing(false);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const cancel = () => {
    setFormData(healthInfo);
    setAllergyText(healthInfo.allergies.join(', '));
    setConditionText(healthInfo.conditions.join(', '));
    setIsEditing(false);
  };

  const inputClass =
    'mt-1.5 w-full rounded-lg border border-border-subtle bg-white px-3 py-2.5 text-sm text-text-main focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15';
  const labelClass = 'block text-sm font-medium text-text-main';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <p className="mb-2 text-sm text-text-secondary">Your information</p>
          <h1 className="font-heading text-3xl font-semibold text-forest">Health details</h1>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3.5 py-2 text-sm font-medium text-text-main hover:border-forest/40"
          >
            <Pencil size={14} /> Edit details
          </button>
        )}
      </header>

      <div className="flex items-start gap-3 border-l-2 border-citron pl-4">
        <div>
          <p className="text-sm font-semibold text-text-main">Patient-provided</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            These details are entered by you and have not been independently verified.
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
        className="space-y-6"
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <label className={labelClass}>
            Blood group
            {isEditing ? (
              <select value={formData.bloodGroup} onChange={(event) => setFormData((current) => ({ ...current, bloodGroup: event.target.value }))} className={inputClass}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            ) : <span className="mt-1.5 block text-sm text-text-secondary">{formData.bloodGroup || 'Not provided'}</span>}
          </label>
          <label className={labelClass}>
            Height
            {isEditing ? (
              <input value={formData.height} onChange={(event) => setFormData((current) => ({ ...current, height: event.target.value }))} className={inputClass} placeholder="e.g. 162 cm" />
            ) : <span className="mt-1.5 block text-sm text-text-secondary">{formData.height || 'Not provided'}</span>}
          </label>
          <label className={labelClass}>
            Weight
            {isEditing ? (
              <input value={formData.weight} onChange={(event) => setFormData((current) => ({ ...current, weight: event.target.value }))} className={inputClass} placeholder="e.g. 56 kg" />
            ) : <span className="mt-1.5 block text-sm text-text-secondary">{formData.weight || 'Not provided'}</span>}
          </label>
        </div>

        <label className={labelClass}>
          Known allergies
          {isEditing ? (
            <textarea rows={2} value={allergyText} onChange={(event) => setAllergyText(event.target.value)} className={inputClass} placeholder="Separate items with commas, or leave blank" />
          ) : <span className="mt-1.5 block text-sm leading-6 text-text-secondary">{formData.allergies.join(', ') || 'Not provided'}</span>}
        </label>

        <label className={labelClass}>
          Existing medical conditions
          {isEditing ? (
            <textarea rows={2} value={conditionText} onChange={(event) => setConditionText(event.target.value)} className={inputClass} placeholder="Separate items with commas, or leave blank" />
          ) : <span className="mt-1.5 block text-sm leading-6 text-text-secondary">{formData.conditions.join(', ') || 'Not provided'}</span>}
        </label>

        <label className={labelClass}>
          Other relevant information
          {isEditing ? (
            <textarea rows={4} value={formData.otherNotes} onChange={(event) => setFormData((current) => ({ ...current, otherNotes: event.target.value }))} className={inputClass} placeholder="Anything else you would like to note" />
          ) : <span className="mt-1.5 block whitespace-pre-wrap text-sm leading-6 text-text-secondary">{formData.otherNotes || 'Not provided'}</span>}
        </label>

        {savedNotice && (
          <p role="status" className="flex items-center gap-2 text-sm text-forest">
            <Check size={16} /> Saved in this browser.
          </p>
        )}
        {isEditing && (
          <div className="flex items-center gap-3 border-t border-border-subtle pt-5">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark">
              <Save size={15} /> Save details
            </button>
            {healthInfo.lastUpdated && (
              <button type="button" onClick={cancel} className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-osco-bg">
                Cancel
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
