import { useCallback, useEffect, useRef, useState } from 'react';
import { getPatientRecords } from '../../api/doctorApi.js';
import { forgetAccess } from '../../api/doctorAccess';
import type { PatientRecords } from '../../types/records';

export type DoctorAccess = { level: 'read' | 'edit'; expiresAt: string };
export type DoctorRecordsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; records: PatientRecords; access: DoctorAccess };

/**
 * The patient's records as this doctor, shared by the four record tabs.
 * The server checks consent on every request; when access has ended or was
 * never granted, onAccessLost runs (back to Find Patient). reload() refetches
 * after an action without flashing the loading state.
 */
export const useDoctorRecords = (publicId: string, onAccessLost: () => void) => {
  const [state, setState] = useState<DoctorRecordsState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const lost = useRef(onAccessLost);
  useEffect(() => {
    lost.current = onAccessLost;
  }, [onAccessLost]);

  useEffect(() => {
    let active = true;
    getPatientRecords(publicId)
      .then(({ data }) => {
        if (!active) return;
        const { access, ...records } = data;
        setState({ status: 'ready', records, access });
      })
      .catch((error: { status?: number; message?: string }) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          forgetAccess(publicId);
          lost.current();
          return;
        }
        setState({ status: 'error', message: error.message ?? 'Could not load the record.' });
      });
    return () => {
      active = false;
    };
  }, [publicId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
};
