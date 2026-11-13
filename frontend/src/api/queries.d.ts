export interface HealthResponse {
  status: string;
  timestamp?: string;
}

export interface PatientProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface PatientAuthResponse {
  data: {
    token: string;
    patient: PatientProfile;
  };
}

export interface PatientProfileResponse {
  data: {
    patient: PatientProfile;
  };
}

export function getBackendHealth(): Promise<HealthResponse>;
export function registerPatient(input: { name: string; email: string; password: string }): Promise<PatientAuthResponse>;
export function loginPatient(input: { email: string; password: string }): Promise<PatientAuthResponse>;
export function getPatientProfile(token: string): Promise<PatientProfileResponse>;
