import React, { useState } from 'react';
import type { PatientContext } from '../../types/navigation';
import type { UploadedDocument } from '../../types/patient';
import FindPatient, { type ApprovedAccessRequest } from '../../pages/doctor/FindPatient';
import PatientRecord, { RECORD_SECTIONS } from '../../pages/doctor/PatientRecord';
import { DoctorDocuments } from '../../pages/doctor/DoctorDocuments';
import { DoctorAssistantChat } from '../../pages/doctor/DoctorAssistantChat';
import { DocumentViewerModal } from '../patient/DocumentViewerModal';
import { DoctorLogin, DoctorStatusNotice } from '../../pages/doctor/DoctorLogin';
import { clearDoctorSession, getDoctorProfile, getDoctorToken, type DoctorProfile } from '../../auth/doctorSession';

export interface DoctorPortalLayoutProps {
  currentPatient: PatientContext | null;
  onSelectPatient: (patient: PatientContext) => void;
  /** Leave the patient (access ended or expired) and return to Find Patient */
  onExitPatient: () => void;
  activeNavItemId: string;
  onNavigate: (section: string) => void;
}

const RECORD_NAV_IDS = new Set<string>(RECORD_SECTIONS.map((section) => section.navId));

/** The limited identification from an approved request, as the app's PatientContext. */
const toPatientContext = (request: ApprovedAccessRequest): PatientContext => ({
  id: request.patientId,
  name: request.patient.name,
  age: request.patient.age ?? 0,
  gender: request.patient.sex ?? '',
  mrn: '',
  dob: '',
  primaryCondition: '',
  status: 'needs_review',
  confidence: 0,
  lastUpdated: request.decidedAt,
});

/**
 * Doctor portal (MVP document 6.2). The doctor signs in first; unverified
 * doctors only see their status. Without an approved patient the doctor
 * sees Find Patient; after approval, the patient record with its four
 * sections. The existing sidebar items for those sections drive the same view.
 */
export const DoctorPortalLayout: React.FC<DoctorPortalLayoutProps> = ({
  currentPatient,
  onSelectPatient,
  onExitPatient,
  activeNavItemId,
  onNavigate,
}) => {
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(() => (getDoctorToken() ? getDoctorProfile() : null));

  const signOut = () => {
    clearDoctorSession();
    setDoctor(null);
    onExitPatient();
  };

  if (!doctor) return <DoctorLogin onLoggedIn={setDoctor} />;
  if (doctor.verificationStatus !== 'verified') return <DoctorStatusNotice profile={doctor} onLogout={signOut} />;

  if (!currentPatient) {
    return (
      <div className="space-y-3">
        <p className="text-right font-inter text-xs text-ink-muted">
          Signed in as <span className="font-medium text-aubergine">{doctor.name}</span> ·{' '}
          <button type="button" onClick={signOut} className="font-medium text-aubergine hover:underline">
            Sign out
          </button>
        </p>
        <FindPatient onApproved={(request) => onSelectPatient(toPatientContext(request))} />
      </div>
    );
  }

  // Sidebar items outside the four record sections keep their existing pages.
  if (activeNavItemId === 'documents') {
    return (
      <>
        <DoctorDocuments documents={[]} onOpenDocument={setSelectedDocument} />
        <DocumentViewerModal document={selectedDocument} onClose={() => setSelectedDocument(null)} />
      </>
    );
  }
  if (activeNavItemId === 'health-assistant') {
    return <DoctorAssistantChat patientName={currentPatient.name} isDemoPatient={false} onOpenDocumentByName={() => {}} />;
  }

  return (
    <PatientRecord
      patient={currentPatient}
      activeNavId={RECORD_NAV_IDS.has(activeNavItemId) ? activeNavItemId : 'emergency-brief'}
      onNavigate={onNavigate}
      onAccessEnded={onExitPatient}
    />
  );
};
