import { useState } from 'react';
import type { PortalType, PatientContext } from './types/navigation';
import { PATIENT_NAV_ITEMS, DOCTOR_NAV_ITEMS } from './types/navigation';
import { AppLayout } from './components/layout/AppLayout';
import { PatientPortalLayout } from './components/layout/PatientPortalLayout';
import { DoctorPortalLayout } from './components/layout/DoctorPortalLayout';
import { MOCK_PATIENT } from './mock/mockData';
import { PatientAuth } from './pages/patient/PatientAuth';
import {
  getCurrentPatient,
  loginPatient,
  logoutPatient,
  registerPatient,
  type PatientAccount,
} from './auth/patientStorage';

export function App() {
  const [portal, setPortal] = useState<PortalType>('patient');
  const [activeItemId, setActiveItemId] = useState<string>('dashboard');
  const [currentPatient, setCurrentPatient] = useState<PatientContext | null>(null);
  const [patientAccount, setPatientAccount] = useState<PatientAccount | null>(() => getCurrentPatient());
  const [authError, setAuthError] = useState('');

  const handlePatientAuth = (action: () => PatientAccount) => {
    try {
      setAuthError('');
      setPatientAccount(action());
      setPortal('patient');
      setActiveItemId('dashboard');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to save demo account.');
    }
  };

  if (portal === 'patient' && !patientAccount) {
    return (
      <PatientAuth
        onRegister={(name, email, password) =>
          handlePatientAuth(() => registerPatient(name, email, password))
        }
        onLogin={(email, password) => handlePatientAuth(() => loginPatient(email, password))}
        onOpenDoctorPortal={() => {
          setCurrentPatient(null);
          setActiveItemId('patient-records');
          setPortal('doctor');
        }}
        error={authError}
      />
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
          ? { ...MOCK_PATIENT, id: patientAccount.id, mrn: '', name: patientAccount.name }
          : portal === 'doctor'
            ? currentPatient
            : null
      }
      onPatientLogout={() => {
        logoutPatient();
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
          activeNavItemId={activeItemId}
          onNavigate={(id) => setActiveItemId(id)}
        />
      )}
    </AppLayout>
  );
}

export default App;
