import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { ORG_SETTINGS_DOC, readOrgSettings } from '../org/orgSettings';

interface UpdateOrgSettingsRequest {
  orgName?: string;
  orgNumber?: string;
  section46CertNumber?: string;
  section46ValidUntil?: number | null;
  commissionPercentage?: number;
  nedarimMosadId?: string;
}

export const updateOrgSettings = onCall<UpdateOrgSettingsRequest>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לשנות את הגדרות הארגון');

  const data = request.data ?? {};
  const db = getFirestore();
  const uid = request.auth!.uid;

  if (data.commissionPercentage !== undefined) {
    const pct = data.commissionPercentage;
    if (typeof pct !== 'number' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      throw new HttpsError('invalid-argument', 'אחוז העמלה חייב להיות מספר בין 0 ל-100');
    }
  }

  const current = await readOrgSettings(db);
  const next = {
    orgName: data.orgName ?? current.orgName,
    orgNumber: data.orgNumber ?? current.orgNumber,
    section46CertNumber: data.section46CertNumber ?? current.section46CertNumber,
    section46ValidUntil:
      data.section46ValidUntil !== undefined ? data.section46ValidUntil : current.section46ValidUntil,
    commissionPercentage: data.commissionPercentage ?? current.commissionPercentage,
    nedarimMosadId: data.nedarimMosadId ?? current.nedarimMosadId,
    updatedBy: uid,
    updatedAt: Date.now(),
  };

  await db.doc(ORG_SETTINGS_DOC).set(next, { merge: true });

  await writeAuditLog(db, {
    adminId: uid,
    action: 'orgSettings.update',
    entity: 'orgSettings',
    entityId: 'main',
    details: { commissionPercentage: next.commissionPercentage },
  });

  return { ok: true };
});
