/**
 * The doctor's login, kept for this browser tab only (like the patient token).
 * The token carries no verification status: the server re-checks it on every request.
 */
const TOKEN_KEY = 'osco.doctorToken';
const PROFILE_KEY = 'osco.doctorProfile';

export interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'revoked';
  statusMessage: string | null;
}

const read = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getDoctorToken = (): string | null => read(TOKEN_KEY);

export const getDoctorProfile = (): DoctorProfile | null => {
  try {
    const raw = read(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as DoctorProfile) : null;
  } catch {
    return null;
  }
};

export const saveDoctorSession = (token: string, profile: DoctorProfile): void => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable: the session lasts for this page only.
  }
};

export const clearDoctorSession = (): void => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
};
