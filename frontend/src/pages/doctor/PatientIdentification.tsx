import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DOCTOR_PATIENTS_LIST } from '../../mock/doctorMockData';
import type { PatientContext } from '../../types/navigation';

export interface PatientIdentificationProps {
  onSelectPatient: (patient: PatientContext) => void;
}

export const PatientIdentification: React.FC<PatientIdentificationProps> = ({
  onSelectPatient,
}) => {
  const [patientId, setPatientId] = useState('');
  const [error, setError] = useState('');

  const identifyPatient = (event: React.FormEvent) => {
    event.preventDefault();
    const enteredId = patientId.trim();
    if (!enteredId) {
      setError('Enter a Patient ID to continue.');
      return;
    }

    try {
      const demoPatient = DOCTOR_PATIENTS_LIST.find(
        (patient) => patient.id.toLowerCase() === enteredId.toLowerCase(),
      );
      if (demoPatient) {
        onSelectPatient(demoPatient);
        return;
      }

      setError('Patient ID not found. Check the ID and try again.');
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Unable to look up this Patient ID.',
      );
    }
  };

  return (
    <section className="mx-auto max-w-2xl py-10 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-eucalyptus-dark">
        Doctor Portal
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-tight text-forest sm:text-5xl">
        Access Patient Record
      </h1>
      <p className="mt-3 max-w-lg text-sm leading-6 text-text-secondary">
        Enter the Patient ID shown in the patient’s portal or QR code.
      </p>

      <form onSubmit={identifyPatient} className="mt-10 max-w-xl">
        <label htmlFor="patient-id" className="mb-2 block text-sm font-medium text-text-main">
          Patient ID
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="patient-id"
            autoComplete="off"
            value={patientId}
            onChange={(event) => {
              setPatientId(event.target.value);
              setError('');
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'patient-id-error' : undefined}
            className="min-w-0 flex-1 border-b border-border-medium bg-transparent px-0 py-3 font-mono text-sm text-text-main outline-none transition-colors placeholder:text-text-muted focus:border-forest"
            placeholder="Enter Patient ID"
          />
          <Button type="submit" variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
            Continue
          </Button>
        </div>
        {error && (
          <p id="patient-id-error" role="alert" className="mt-3 text-sm text-warning">
            {error}
          </p>
        )}
      </form>
    </section>
  );
};
