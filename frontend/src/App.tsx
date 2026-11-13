import { useEffect, useState } from 'react';
import type { PortalType, PatientContext } from './types/navigation';
import { PATIENT_NAV_ITEMS, DOCTOR_NAV_ITEMS } from './types/navigation';
import { AppLayout } from './components/layout/AppLayout';
import { PatientPortalLayout } from './components/layout/PatientPortalLayout';
import { DoctorPortalLayout } from './components/layout/DoctorPortalLayout';
import { PatientAuth } from './pages/patient/PatientAuth';
import { BackendStatusIndicator } from './components/ui/BackendStatusIndicator';
import { clearAuthToken, getAuthToken, saveAuthToken, type PatientAccount } from './auth/patientStorage';
import { getPatientProfile, loginPatient, registerPatient } from './api/queries.js';

export function App() {
  const [portal, setPortal] = useState<PortalType>('patient');
  const [activeItemId, setActiveItemId] = useState<string>('dashboard');
  const [currentPatient, setCurrentPatient] = useState<PatientContext | null>(null);
  const [patientAccount, setPatientAccount] = useState<PatientAccount | null>(null);
  const [authReady, setAuthReady] = useState(() => !getAuthToken());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthReady(true);
      return;
    }

    let active = true;
    getPatientProfile(token)
      .then(({ data }) => {
        if (active) setPatientAccount(data.patient);
      })
      .catch(() => {
        if (active) {
          clearAuthToken();
          setPatientAccount(null);
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const handlePatientAuth = async (
    action: () => Promise<{ data: { token: string; patient: PatientAccount } }>,
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      setAuthError('');
      const { data } = await action();
      saveAuthToken(data.token);
      setPatientAccount(data.patient);
      setPortal('patient');
      setActiveItemId('dashboard');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!authReady && portal === 'patient') {
    return (
      <>
        <BackendStatusIndicator />
        <main className="min-h-screen flex items-center justify-center bg-osco-bg text-sm text-text-secondary">
          Checking your patient session…
        </main>
      </>
    );
  }

  if (portal === 'patient' && !patientAccount) {
    return (
      <>
        <BackendStatusIndicator />
        <PatientAuth
          onRegister={(name, email, password) =>
            handlePatientAuth(() => registerPatient({ name, email, password }))
          }
          onLogin={(email, password) => handlePatientAuth(() => loginPatient({ email, password }))}
          onOpenDoctorPortal={() => {
            setCurrentPatient(null);
            setActiveItemId('patient-records');
            setPortal('doctor');
          }}
          error={authError}
          isSubmitting={isSubmitting}
        />
      </>
    );
  }

  const handlePortalChange = (newPortal: PortalType) => {
    setPortal(newPortal);
    setCurrentPatient(null);
    if (newPortal === 'patient') {
      setActiveItemId('dashboard');
    } else {
      setActiveItemId('patient-records');
    }
  };

  const currentNavItems = portal === 'patient' ? PATIENT_NAV_ITEMS : DOCTOR_NAV_ITEMS;
  const activeNavObj = currentNavItems.find((item) => item.id === activeItemId);
  const activeSectionTitle = activeNavObj?.label || 'Workspace';

  return (
    <>
      <BackendStatusIndicator />
      <AppLayout
        portal={portal}
        onPortalChange={handlePortalChange}
        activeItemId={activeItemId}
        onNavigate={(id) => {
          setActiveItemId(id);
        }}
        activeSectionTitle={activeSectionTitle}
        currentPatient={
          portal === 'patient' && patientAccount
            ? {
                id: patientAccount.id,
                name: patientAccount.name,
                age: 0,
                gender: '',
                mrn: '',
                dob: '',
                primaryCondition: '',
                status: 'needs_review',
                confidence: 0,
                lastUpdated: patientAccount.createdAt,
              }
            : portal === 'doctor'
              ? currentPatient
              : null
        }
        onPatientLogout={() => {
          clearAuthToken();
          setPatientAccount(null);
          setCurrentPatient(null);
          setPortal('patient');
          setActiveItemId('dashboard');
        }}
      >
        {portal === 'patient' ? (
          <PatientPortalLayout
            activeItemId={activeItemId}
            onNavigate={(id) => setActiveItemId(id)}
            key={patientAccount?.id}
            patient={{ id: patientAccount!.id, name: patientAccount!.name }}
          />
        ) : (
          <DoctorPortalLayout
            key={currentPatient?.id ?? 'identify'}
            currentPatient={currentPatient}
            onSelectPatient={(pt) => {
              setCurrentPatient(pt);
              setActiveItemId('emergency-brief');
            }}
            onExitPatient={() => {
              setCurrentPatient(null);
              setActiveItemId('patient-records');
            }}
            activeNavItemId={activeItemId}
            onNavigate={(id) => setActiveItemId(id)}
          />
        )}
      </AppLayout>
    </>
  );
}

export default App;
