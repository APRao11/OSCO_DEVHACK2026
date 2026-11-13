import { useMemo, useState } from 'react';
import { EmergencyBriefReport } from './EmergencyBriefReport';
import { useDoctorRecords } from './useDoctorRecords';
import { TabStatus } from '../../components/brief/DoctorPageShell';
import { LazySourceViewer } from '../../components/records/LazySourceViewer';
import { toBriefData } from '../../records/doctorView';
import { sourceTargetFor } from '../../records/source';

/**
 * Report tab for a real patient: the same bento Emergency Brief as the sample,
 * built by fixed rules from the patient's confirmed records. Source chips open
 * the original document at the highlighted quote.
 */
export default function DoctorReportTab({ patient, onAccessLost, onNavigate }) {
  const { state } = useDoctorRecords(patient.id, onAccessLost);
  const [target, setTarget] = useState(null);
  const data = useMemo(() => (state.status === 'ready' ? toBriefData(state.records) : null), [state]);

  if (state.status !== 'ready') return <TabStatus title="Emergency Brief" state={state} />;
  return (
    <>
      <EmergencyBriefReport
        data={data}
        onOpenTimeline={() => onNavigate('medical-history')}
        onReview={() => onNavigate('review-verification')}
        onOpenSource={(source) => {
          if (source.findingId) setTarget(sourceTargetFor(state.records, source.findingId));
        }}
      />
      <LazySourceViewer target={target} onClose={() => setTarget(null)} />
    </>
  );
}
