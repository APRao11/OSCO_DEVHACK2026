import React from 'react';
import {
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/ui/Card';
import type { PatientContext } from '../../types/navigation';
import type { PersonalHealthInfo } from '../../types/patient';

export interface PatientOverviewProps {
  patient: PatientContext;
  healthInfo: PersonalHealthInfo;
  onNavigate: (section: string) => void;
}

export const PatientOverview: React.FC<PatientOverviewProps> = ({
  patient,
  healthInfo,
  onNavigate,
}) => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Editorial Header Section */}
      <section className="border-b border-border-subtle pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono uppercase bg-forest text-white px-2 py-0.5 rounded font-semibold tracking-wider">
                SUBJECT DOSSIER
              </span>
              <Badge variant="verified" size="sm" isMono dot>
                LONGITUDINAL ENCLAVE VERIFIED
              </Badge>
              <span className="text-xs font-mono text-text-muted">
                MRN: {patient.mrn}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold font-heading text-forest tracking-tight">
              {patient.name}
            </h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-2xl font-body leading-relaxed">
              {patient.age}y • {patient.gender} • Born {patient.dob}. Primary clinical focus:{' '}
              <strong className="text-text-main font-semibold">{patient.primaryCondition}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="citron"
              size="md"
              onClick={() => onNavigate('emergency-brief')}
            >
              Open Emergency Brief →
            </Button>
          </div>
        </div>

        {/* Provenance Clarification Banner */}
        <div className="mt-5 p-3.5 bg-white border border-border-subtle rounded-lg flex flex-wrap items-center justify-between text-xs gap-3 shadow-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-text-main font-heading">Data Origin Standard:</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-warning-subtle text-warning border border-warning/30 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              PATIENT-PROVIDED (Unverified)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-osco-bg text-forest border border-border-subtle font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-forest" />
              AI-EXTRACTED (OCR Provenance)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#EBF2EF] text-forest border border-eucalyptus/50 font-mono text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-forest" />
              DOCTOR-VERIFIED (Physician Signed)
            </span>
          </div>

          <span className="font-mono text-[11px] text-text-muted">
            Last Audit: {patient.lastUpdated}
          </span>
        </div>
      </section>

      {/* Grid: 3 Origin Layers Compared Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Layer 1: Patient-Provided Details */}
        <Card accent="warning">
          <CardHeader
            title="1. Patient-Provided"
            subtitle="Self-reported demographic & baseline info"
            badge={
              <Badge variant="warning" size="sm" isMono dot>
                SELF-REPORTED
              </Badge>
            }
          />
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-text-muted uppercase">
                Blood Group (Self-Reported)
              </div>
              <div className="text-base font-bold font-mono text-forest">
                {healthInfo.bloodGroup}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-osco-bg rounded border border-border-subtle">
                <span className="text-[10px] font-mono text-text-muted block">Height</span>
                <span className="font-mono font-semibold">{healthInfo.height}</span>
              </div>
              <div className="p-2.5 bg-osco-bg rounded border border-border-subtle">
                <span className="text-[10px] font-mono text-text-muted block">Weight</span>
                <span className="font-mono font-semibold">{healthInfo.weight}</span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-mono text-text-muted uppercase">
                Self-Declared Allergies
              </div>
              <div className="space-y-1">
                {healthInfo.allergies.map((all, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-warning-subtle text-warning border border-warning/30 text-[11px]"
                  >
                    {all}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-[10px] font-mono text-text-muted uppercase">
                Lifestyle & Diet Notes
              </div>
              <p className="text-text-secondary leading-relaxed text-[11px] bg-osco-bg p-2.5 rounded border border-border-subtle">
                {healthInfo.otherNotes}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[10px] font-mono text-text-muted">
              Source: Patient intake app
            </span>
          </CardFooter>
        </Card>

        {/* Layer 2: AI-Extracted Entities */}
        <Card accent="forest">
          <CardHeader
            title="2. AI-Extracted"
            subtitle="Deterministic OCR from lab & EHR feeds"
            badge={
              <Badge variant="forest" size="sm" isMono>
                98.4% CONF.
              </Badge>
            }
          />
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 bg-osco-bg rounded border border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-text-main">HbA1c Glycated Hemoglobin</span>
                <span className="text-forest font-bold">6.8%</span>
              </div>
              <div className="text-[10px] text-text-muted font-mono">
                LOINC 4548-4 • LabCorp Report (Page 2)
              </div>
            </div>

            <div className="p-3 bg-osco-bg rounded border border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-text-main">Fasting Blood Glucose</span>
                <span className="text-forest font-bold">124 mg/dL</span>
              </div>
              <div className="text-[10px] text-text-muted font-mono">
                LOINC 1558-6 • Verified vs 2025 baseline
              </div>
            </div>

            <div className="p-3 bg-osco-bg rounded border border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-text-main">Glomerular Filtration Rate</span>
                <span className="text-forest font-bold">88 mL/min</span>
              </div>
              <div className="text-[10px] text-text-muted font-mono">
                LOINC 33914-3 • Normal clearance
              </div>
            </div>

            <div className="p-3 bg-osco-bg rounded border border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-text-main">Bilateral Retinopathy Exam</span>
                <span className="text-forest font-bold">Clear</span>
              </div>
              <div className="text-[10px] text-text-muted font-mono">
                Pacific Eye Center • Dilated Exam
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[10px] font-mono text-text-muted">
              Source: 6 Ingested documents
            </span>
          </CardFooter>
        </Card>

        {/* Layer 3: Doctor-Verified Clinical Ledger */}
        <Card accent="eucalyptus">
          <CardHeader
            title="3. Doctor-Verified"
            subtitle="Clinically signed diagnostic milestones"
            badge={
              <Badge variant="verified" size="sm" isMono dot>
                PHYSICIAN SIGNED
              </Badge>
            }
          />
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 bg-[#FAFCFB] rounded border border-border-subtle space-y-1">
              <div className="font-semibold font-heading text-forest">
                Type 2 Diabetes Mellitus
              </div>
              <div className="text-[11px] text-text-secondary leading-snug">
                Verified by Dr. Marcus Webb. Maintenance therapy on Metformin ER.
              </div>
              <div className="text-[10px] font-mono text-text-muted pt-1">
                ICD-10: E11.9 • Signed 2025-06-15
              </div>
            </div>

            <div className="p-3 bg-[#FAFCFB] rounded border border-border-subtle space-y-1">
              <div className="font-semibold font-heading text-forest">
                Empagliflozin Titration (10mg)
              </div>
              <div className="text-[11px] text-text-secondary leading-snug">
                Verified by Dr. Alistair Chen. Initiated for cardiorenal benefit.
              </div>
              <div className="text-[10px] font-mono text-text-muted pt-1">
                RxNorm: 1545653 • Signed 2026-08-14
              </div>
            </div>

            <div className="p-3 bg-[#FAFCFB] rounded border border-border-subtle space-y-1">
              <div className="font-semibold font-heading text-forest">
                Glipizide Cessation Protocol
              </div>
              <div className="text-[11px] text-text-secondary leading-snug">
                Verified cessation due to nocturnal hypoglycemia avoidance.
              </div>
              <div className="text-[10px] font-mono text-text-muted pt-1">
                Signed by Dr. Alistair Chen
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[10px] font-mono text-forest font-semibold">
              3 Physician signatures active
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* Quick Navigation Footer Strip */}
      <div className="p-4 bg-white rounded-lg border border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-text-secondary">
          Ready to review clinical synthesis, safety contradictions, and care milestones?
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('medical-history')}
          >
            Complete History
          </Button>
          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight size={13} />}
            onClick={() => onNavigate('emergency-brief')}
          >
            Emergency Brief
          </Button>
        </div>
      </div>
    </div>
  );
};
