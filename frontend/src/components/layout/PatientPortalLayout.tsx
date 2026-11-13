import React, { useEffect, useState } from 'react';
import type { PatientContext } from '../../types/navigation';
import type {
  UploadedDocument,
  TimelineEvent,
} from '../../types/patient';
import { loadPatientData, savePatientData } from '../../auth/patientStorage';

import { PatientDashboard } from '../../pages/patient/PatientDashboard';
import { PersonalHealthDetails } from '../../pages/patient/PersonalHealthDetails';
import { UploadDocuments } from '../../pages/patient/UploadDocuments';
import { MedicalHistoryTimeline } from '../../pages/patient/MedicalHistoryTimeline';
import { DocumentsLibrary } from '../../pages/patient/DocumentsLibrary';
import { HealthAssistantWidget } from '../patient/HealthAssistantWidget';

import { TimelineDetailDrawer } from '../patient/TimelineDetailDrawer';
import { DocumentViewerModal } from '../patient/DocumentViewerModal';
import { LazySourceViewer } from '../records/LazySourceViewer';
import { DEMO_RECORDS } from '../../records/demoRecords';
import { sourceTargetFor } from '../../records/source';
import type { SourceTarget } from '../../types/records';

// There is no records API yet, so the timeline shows the synthetic demo patient.
const DEMO_NOTICE =
  'Showing the synthetic demo patient. Your own uploads will appear here once the records API is connected.';

export interface PatientPortalLayoutProps {
  activeItemId: string;
  onNavigate: (itemId: string) => void;
  patient: Pick<PatientContext, 'id' | 'name'>;
}

export const PatientPortalLayout: React.FC<PatientPortalLayoutProps> = ({
  activeItemId,
  onNavigate,
  patient,
}) => {
  const [patientData, setPatientData] = useState(() => loadPatientData(patient.id));
  const { healthInfo, documents, timelineEvents } = patientData;

  useEffect(() => {
    savePatientData(patient.id, patientData);
  }, [patient.id, patientData]);

  // Active modal/drawer selection
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<TimelineEvent | null>(
    null
  );
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null);

  // Handler to open a document by name (e.g. from timeline drawer or citations)
  const handleOpenDocByName = (docName: string) => {
    const found = documents.find(
      (d) => d.name.toLowerCase() === docName.toLowerCase()
    );
    if (found) {
      setSelectedDocument(found);
    }
  };

  // Add newly uploaded documents
  const handleAddDocuments = (newDocs: UploadedDocument[]) => {
    setPatientData((prev) => ({ ...prev, documents: [...newDocs, ...prev.documents] }));
  };

  const handleUpdateDocuments = (updatedDocs: UploadedDocument[]) => {
    const updatedById = new Map(updatedDocs.map((doc) => [doc.id, doc]));
    setPatientData((prev) => ({
      ...prev,
      documents: prev.documents.map((doc) => updatedById.get(doc.id) ?? doc),
    }));
  };

  // Route matching
  const renderCurrentPage = () => {
    switch (activeItemId) {
      case 'dashboard':
      case 'overview':
        return (
          <PatientDashboard
            patient={patient}
            healthInfo={healthInfo}
            timelineEvents={timelineEvents}
            documents={documents}
            onNavigate={onNavigate}
            onSelectEvent={(ev) => setSelectedTimelineEvent(ev)}
          />
        );

      case 'health-details':
      case 'profile':
        return (
          <PersonalHealthDetails
            healthInfo={healthInfo}
            onSave={(updated) => setPatientData((prev) => ({ ...prev, healthInfo: updated }))}
          />
        );

      case 'upload':
        return (
          <UploadDocuments
            documents={documents}
            onAddDocuments={handleAddDocuments}
            onUpdateDocuments={handleUpdateDocuments}
          />
        );

      case 'medical-history':
        return (
          <MedicalHistoryTimeline
            records={DEMO_RECORDS}
            onOpenSource={(findingId) => setSourceTarget(sourceTargetFor(DEMO_RECORDS, findingId))}
            notice={DEMO_NOTICE}
          />
        );

      case 'documents':
        return (
          <DocumentsLibrary
            documents={documents}
            onOpenDocument={(doc) => setSelectedDocument(doc)}
            onNavigateUpload={() => onNavigate('upload')}
          />
        );

      default:
        return (
          <PatientDashboard
            patient={patient}
            healthInfo={healthInfo}
            timelineEvents={timelineEvents}
            documents={documents}
            onNavigate={onNavigate}
            onSelectEvent={(ev) => setSelectedTimelineEvent(ev)}
          />
        );
    }
  };

  return (
    <>
      {renderCurrentPage()}

      {/* Timeline Detail Side Panel Drawer */}
      <TimelineDetailDrawer
        event={selectedTimelineEvent}
        onClose={() => setSelectedTimelineEvent(null)}
        onOpenDocument={handleOpenDocByName}
      />

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
      />

      <LazySourceViewer target={sourceTarget} onClose={() => setSourceTarget(null)} />

      <HealthAssistantWidget />
    </>
  );
};
