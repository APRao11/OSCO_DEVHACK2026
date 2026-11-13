import React, { useState } from 'react';
import type { PatientContext } from '../../types/navigation';
import type { TimelineEvent, UploadedDocument, PersonalHealthInfo } from '../../types/patient';
import type { ReviewItem, MissingInfoGap, VerificationStatus } from '../../types/doctor';
import {
  INITIAL_TIMELINE_EVENTS,
  INITIAL_DOCUMENTS,
  INITIAL_PERSONAL_HEALTH_INFO,
} from '../../mock/patientMockData';
import { INITIAL_REVIEW_ITEMS, MOCK_MISSING_INFO_GAPS } from '../../mock/doctorMockData';
import { loadPatientData, savePatientData } from '../../auth/patientStorage';
import { PatientIdentification } from '../../pages/doctor/PatientIdentification';
import { EmergencyBrief } from '../../pages/doctor/EmergencyBrief';
import { DoctorMedicalHistory } from '../../pages/doctor/DoctorMedicalHistory';
import { ReviewVerification } from '../../pages/doctor/ReviewVerification';
import { DoctorDocuments } from '../../pages/doctor/DoctorDocuments';
import { AddClinicalRecord } from '../../pages/doctor/AddClinicalRecord';
import { DoctorAssistantChat } from '../../pages/doctor/DoctorAssistantChat';
import { TimelineDetailDrawer } from '../patient/TimelineDetailDrawer';
import { DocumentViewerModal } from '../patient/DocumentViewerModal';

export interface DoctorPortalLayoutProps {
  currentPatient: PatientContext | null;
  onSelectPatient: (patient: PatientContext) => void;
  activeNavItemId: string;
  onNavigate: (section: string) => void;
}

const EMPTY_HEALTH_INFO: PersonalHealthInfo = {
  bloodGroup: '',
  height: '',
  weight: '',
  allergies: [],
  conditions: [],
  otherNotes: '',
  lastUpdated: '',
};

const EMPTY_PATIENT_DATA = {
  healthInfo: EMPTY_HEALTH_INFO,
  documents: [] as UploadedDocument[],
  timelineEvents: [] as TimelineEvent[],
};

export const DoctorPortalLayout: React.FC<DoctorPortalLayoutProps> = ({
  currentPatient,
  onSelectPatient,
  activeNavItemId,
  onNavigate,
}) => {
  const isDemoPatient = currentPatient?.id === 'pt-8812';
  const [patientData] = useState(() => {
    if (isDemoPatient) {
      return {
        healthInfo: INITIAL_PERSONAL_HEALTH_INFO,
        documents: INITIAL_DOCUMENTS,
        timelineEvents: INITIAL_TIMELINE_EVENTS,
      };
    }
    return currentPatient ? loadPatientData(currentPatient.id) : EMPTY_PATIENT_DATA;
  });
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(patientData.timelineEvents);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(
    isDemoPatient ? INITIAL_REVIEW_ITEMS : [],
  );
  const [missingGaps] = useState<MissingInfoGap[]>(
    isDemoPatient ? MOCK_MISSING_INFO_GAPS : [],
  );
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<TimelineEvent | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);

  const handleOpenDocByName = (docName: string) => {
    const found = patientData.documents.find(
      (document) => document.name.toLowerCase() === docName.toLowerCase(),
    );
    if (found) setSelectedDocument(found);
  };

  const handleUpdateReviewItem = (
    id: string,
    newStatus: VerificationStatus,
    note?: string,
  ) => {
    setReviewItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              status: newStatus,
              doctorNotes: note || item.doctorNotes,
              verifiedBy: 'Doctor',
              verifiedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  const handleAddTimelineEvent = (newEvent: TimelineEvent) => {
    const updatedEvents = [newEvent, ...timelineEvents];
    setTimelineEvents(updatedEvents);
    if (currentPatient && !isDemoPatient) {
      savePatientData(currentPatient.id, {
        ...patientData,
        timelineEvents: updatedEvents,
      });
    }
  };

  if (!currentPatient) {
    return <PatientIdentification onSelectPatient={onSelectPatient} />;
  }

  const renderDoctorPage = () => {
    switch (activeNavItemId) {
      case 'medical-history':
        return (
          <DoctorMedicalHistory
            events={timelineEvents}
            onSelectEvent={setSelectedTimelineEvent}
          />
        );
      case 'review-verification':
        return (
          <ReviewVerification
            reviewItems={reviewItems}
            onUpdateReviewItem={handleUpdateReviewItem}
            onOpenDocument={handleOpenDocByName}
          />
        );
      case 'documents':
        return (
          <DoctorDocuments
            documents={patientData.documents}
            onOpenDocument={setSelectedDocument}
          />
        );
      case 'add-record':
        return (
          <AddClinicalRecord
            patientName={currentPatient.name}
            patientId={currentPatient.id}
            onAddTimelineEvent={handleAddTimelineEvent}
            onNavigateHistory={() => onNavigate('medical-history')}
          />
        );
      case 'health-assistant':
        return (
          <DoctorAssistantChat
            patientName={currentPatient.name}
            isDemoPatient={isDemoPatient}
            onOpenDocumentByName={handleOpenDocByName}
          />
        );
      case 'emergency-brief':
      default:
        return (
          <EmergencyBrief
            patient={currentPatient}
            healthInfo={patientData.healthInfo}
            timelineEvents={timelineEvents}
            reviewItems={reviewItems}
            missingGaps={missingGaps}
            onOpenDocument={handleOpenDocByName}
            onOpenTimelineEvent={setSelectedTimelineEvent}
            onNavigateReview={() => onNavigate('review-verification')}
          />
        );
    }
  };

  return (
    <>
      {renderDoctorPage()}
      <TimelineDetailDrawer
        event={selectedTimelineEvent}
        onClose={() => setSelectedTimelineEvent(null)}
        onOpenDocument={handleOpenDocByName}
      />
      <DocumentViewerModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
      />
    </>
  );
};
