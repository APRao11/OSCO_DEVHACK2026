import React, { useEffect, useState } from 'react';
import type { PatientContext } from '../../types/navigation';
import type {
  UploadedDocument,
  TimelineEvent,
} from '../../types/patient';
import { getAuthToken, loadPatientData, savePatientData } from '../../auth/patientStorage';
import { listDocuments, type ProcessedDocument } from '../../api/queries.js';

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

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  prescription: 'Prescription',
  lab_report: 'Laboratory report',
  discharge_summary: 'Discharge summary',
  imaging_report: 'Imaging report',
  clinical_note: 'Consultation note',
  other: 'Other document',
};

const STATUS: Record<ProcessedDocument['status'], UploadedDocument['status']> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Completed',
  failed: 'Failed',
};

/** A server document in the shape the existing Dashboard and Documents pages use. */
const toUploadedDocument = (doc: ProcessedDocument): UploadedDocument => ({
  id: doc.id,
  name: doc.name,
  type: doc.documentType ? DOCUMENT_TYPE_LABELS[doc.documentType] ?? 'Document' : doc.status === 'failed' ? 'Could not be read' : 'Being processed',
  fileFormat: doc.mimeType === 'application/pdf' ? 'PDF' : (doc.mimeType.split('/')[1] ?? 'FILE').toUpperCase(),
  size: doc.byteSize >= 1024 * 1024 ? `${(doc.byteSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(doc.byteSize / 1024))} KB`,
  uploadDate: doc.uploadedAt.slice(0, 10),
  relevantDate: doc.documentDate ?? '',
  status: STATUS[doc.status],
  facility: doc.findingsCount ? `${doc.findingsCount} verified finding${doc.findingsCount === 1 ? '' : 's'}` : '',
  pageCount: doc.pageCount ?? undefined,
});

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
  // Documents come from the server only. The old browser-only list (patientData.documents)
  // is ignored: it was filled by the earlier simulated upload page and never reached the server.
  const { healthInfo, timelineEvents } = patientData;
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

  useEffect(() => {
    savePatientData(patient.id, patientData);
  }, [patient.id, patientData]);

  // Reload on every page change, so Dashboard and Documents show uploads made a moment ago.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return undefined;
    let active = true;
    listDocuments(token)
      .then(({ data }) => {
        if (active) setDocuments(data.documents.map(toUploadedDocument));
      })
      .catch(() => {
        // Keep the last list; the Upload page shows connection errors.
      });
    return () => {
      active = false;
    };
  }, [activeItemId]);

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
          <UploadDocuments />
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
