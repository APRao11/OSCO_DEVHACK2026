import React, { useState } from 'react';
import {
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { TimelineEvent } from '../../types/patient';
import type { NewClinicalRecordInput } from '../../types/doctor';

export interface AddClinicalRecordProps {
  patientName: string;
  patientId: string;
  onAddTimelineEvent: (event: TimelineEvent) => void;
  onNavigateHistory: () => void;
}

export const AddClinicalRecord: React.FC<AddClinicalRecordProps> = ({
  patientName,
  patientId,
  onAddTimelineEvent,
  onNavigateHistory,
}) => {
  const [formData, setFormData] = useState<NewClinicalRecordInput>({
    consultationDate: new Date().toISOString().split('T')[0],
    diagnosis: '',
    icdCode: '',
    prescription: '',
    investigations: '',
    observations: '',
    doctorName: 'Dr. Alistair Chen, MD',
    facilityName: 'Bay Health Endocrine Institute',
  });

  const [formError, setFormError] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.diagnosis.trim()) {
      setFormError('Clinical Diagnosis is required to log a consultation milestone.');
      return;
    }

    setFormError('');

    // Construct new timeline event
    const newEvent: TimelineEvent = {
      id: `EVT-${Date.now().toString().slice(-4)}`,
      date: formData.consultationDate,
      category: 'Consultation',
      title: formData.diagnosis,
      description: formData.observations || `Outpatient encounter documented by ${formData.doctorName}.`,
      facility: formData.facilityName,
      doctor: formData.doctorName,
      sourceDoc: '',
      sourcePage: 1,
      confidence: 100, // Directly physician entered
      aiSummary: `Physician consultation entry signed by ${formData.doctorName}. Diagnosis: ${formData.diagnosis}. Prescription: ${formData.prescription || 'None documented'}. Investigations ordered: ${formData.investigations || 'None'}.`,
      extractedDetails: [
        { label: 'Attending Clinician', value: formData.doctorName },
        { label: 'Facility', value: formData.facilityName },
        ...(formData.icdCode ? [{ label: 'ICD-10 Code', value: formData.icdCode }] : []),
        ...(formData.investigations ? [{ label: 'Ordered Labs', value: formData.investigations }] : []),
      ],
      medicationDetails: formData.prescription
        ? {
            name: formData.prescription,
            dosage: 'As prescribed',
            status: 'Started',
            reason: formData.diagnosis,
            isCurrentlyActive: true,
            prescribingDoctor: formData.doctorName,
          }
        : undefined,
    };

    onAddTimelineEvent(newEvent);
    setSuccessNotice(true);

    // Reset form
    setFormData({
      consultationDate: new Date().toISOString().split('T')[0],
      diagnosis: '',
      icdCode: '',
      prescription: '',
      investigations: '',
      observations: '',
      doctorName: 'Dr. Alistair Chen, MD',
      facilityName: 'Bay Health Endocrine Institute',
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <section className="border-b border-border-subtle pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
              DIRECT PHYSICIAN ENCOUNTER
            </span>
            <Badge variant="verified" size="sm" isMono dot>
              RECONSTRUCTION               BROWSER DEMO
            </Badge>
          </div>
          <h1 className="text-3xl font-bold font-heading text-forest tracking-tight">
            Add Clinical Record
          </h1>
          <p className="text-sm text-text-secondary font-body leading-relaxed max-w-2xl">
            Add a clinician-entered note for <strong>{patientName}</strong> ({patientId}). It is saved
            to this patient’s local demo timeline.
          </p>
        </div>

        {successNotice && (
          <div className="mt-4 p-4 bg-[#EBF2EF] border border-[#C2D8D2] rounded-md text-xs text-forest flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>
                Clinical note added to this patient’s timeline.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateHistory}
            >
              View in Timeline →
            </Button>
          </div>
        )}
      </section>

      {/* Entry Form */}
      <Card accent="forest">
        <form onSubmit={handleSubmit}>
          <CardHeader
            title="Encounter details"
            subtitle="Entries are saved in this browser and kept separate by Patient ID."
          />

          <CardContent className="space-y-6">
            {formError && (
              <div className="p-3 bg-warning-subtle text-warning border border-warning/30 rounded text-xs">
                {formError}
              </div>
            )}

            {/* Row 1: Date & Clinician */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Encounter Date
                </label>
                <Input
                  type="date"
                  value={formData.consultationDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, consultationDate: e.target.value }))
                  }
                  isMono
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Attending Physician
                </label>
                <Input
                  value={formData.doctorName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, doctorName: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Clinical Facility
                </label>
                <Input
                  value={formData.facilityName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, facilityName: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Row 2: Diagnosis & ICD-10 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border-subtle">
              <div className="sm:col-span-2">
                <Input
                  label="Primary Clinical Diagnosis"
                  placeholder="e.g. Type 2 Diabetes Follow-up, Glycemic Stabilization"
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, diagnosis: e.target.value }))
                  }
                  helperText="Primary assessment finding for this encounter"
                />
              </div>

              <div>
                <Input
                  label="ICD-10 Code (Optional)"
                  placeholder="e.g. E11.9, Z13.89"
                  value={formData.icdCode}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, icdCode: e.target.value }))
                  }
                  isMono
                  helperText="Standard coding ontology"
                />
              </div>
            </div>

            {/* Row 3: Prescriptions & Ordered Investigations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Prescription / Medication Titration
                </label>
                <textarea
                  rows={3}
                  value={formData.prescription}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, prescription: e.target.value }))
                  }
                  placeholder="e.g. Empagliflozin 10mg oral daily morning, continue Metformin ER 1000mg BID..."
                  className="w-full text-xs font-body border border-border-subtle rounded-md p-2.5 focus:border-forest focus:ring-1 focus:ring-forest bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                  Ordered Investigations / Diagnostic Tests
                </label>
                <textarea
                  rows={3}
                  value={formData.investigations}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, investigations: e.target.value }))
                  }
                  placeholder="e.g. Spot urine microalbumin-to-creatinine ratio (uACR), repeat HbA1c in 90 days..."
                  className="w-full text-xs font-body border border-border-subtle rounded-md p-2.5 focus:border-forest focus:ring-1 focus:ring-forest bg-white"
                />
              </div>
            </div>

            {/* Row 4: Clinical Observations */}
            <div className="pt-2 border-t border-border-subtle">
              <label className="block text-xs font-semibold text-text-main mb-1.5 uppercase tracking-wider">
                Clinical Observations & Progress Summary
              </label>
              <textarea
                rows={4}
                value={formData.observations}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, observations: e.target.value }))
                }
                placeholder="Patient presents alert and oriented. Reports improved energy levels without symptomatic hypoglycemia. Foot exam reveals intact sensation to 10g monofilament..."
                className="w-full text-xs font-body border border-border-subtle rounded-md p-2.5 focus:border-forest focus:ring-1 focus:ring-forest bg-white"
              />
            </div>
          </CardContent>

          <CardFooter>
            <span className="text-[11px] font-mono text-text-muted">
              Saved locally in this browser
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="citron"
                size="md"
                leftIcon={<Save size={15} />}
              >
                Save Record
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
