export type VerificationStatus = 'unverified' | 'verified' | 'corrected' | 'flagged';

export interface ReviewItem {
  id: string;
  type: 'contradiction' | 'duplicate' | 'uncertain_extraction';
  title: string;
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  sourceA: {
    docName: string;
    page: number;
    facility: string;
    date: string;
    value: string;
  };
  sourceB?: {
    docName: string;
    page: number;
    facility: string;
    date: string;
    value: string;
  };
  confidence: number;
  status: VerificationStatus;
  doctorNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface MissingInfoGap {
  id: string;
  title: string;
  clinicalRelevance: string;
  suggestedAction: string;
  timeframe: string;
}

export interface NewClinicalRecordInput {
  consultationDate: string;
  diagnosis: string;
  icdCode?: string;
  prescription: string;
  investigations: string;
  observations: string;
  doctorName: string;
  facilityName: string;
}
