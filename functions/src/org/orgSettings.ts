import type { Firestore } from 'firebase-admin/firestore';

export const ORG_SETTINGS_DOC = 'orgSettings/main';

export interface OrgSettings {
  orgName: string;
  orgNumber: string;
  section46CertNumber: string;
  section46ValidUntil: number | null;
  commissionPercentage: number;
  /** Nedarim Plus institution number (7 digits). The password lives in Secrets. */
  nedarimMosadId: string;
  updatedBy?: string;
  updatedAt: number;
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  orgName: '',
  orgNumber: '',
  section46CertNumber: '',
  section46ValidUntil: null,
  commissionPercentage: 5,
  nedarimMosadId: '',
  updatedAt: 0,
};

export async function readOrgSettings(db: Firestore): Promise<OrgSettings> {
  const snap = await db.doc(ORG_SETTINGS_DOC).get();
  if (!snap.exists) return DEFAULT_ORG_SETTINGS;
  return { ...DEFAULT_ORG_SETTINGS, ...(snap.data() as Partial<OrgSettings>) };
}
