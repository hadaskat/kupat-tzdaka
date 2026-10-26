import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, getAuth } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';

/**
 * Sets the full list of supervisors for ONE fund (spec §3).
 *
 * Fund-centric on purpose: the admin thinks "who may watch this fund", not
 * "which funds may this person watch". Assigning a plain client here promotes
 * them to fundManager, which is how a new supervisor gets created at all.
 *
 * Super admins are never touched - they already see everything, and demoting
 * one by unticking a fund would be a surprising side effect.
 */
export const setFundSupervisors = onCall<{ fundId: string; uids: string[] }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לשנות הרשאות');

  const { fundId, uids } = request.data ?? {};
  if (!fundId || !Array.isArray(uids)) {
    throw new HttpsError('invalid-argument', 'נדרש מזהה קרן ורשימת משתמשים');
  }

  const db = getFirestore();
  const auth = getAuth();

  const fundSnap = await db.collection('funds').doc(fundId).get();
  if (!fundSnap.exists) {
    throw new HttpsError('not-found', 'הקרן לא נמצאה');
  }

  const usersSnap = await db.collection('users').get();
  const requested = new Set(uids);
  const promoted: string[] = [];
  const batch = db.batch();

  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (data.role === 'superAdmin') continue;

    const currentFundIds: string[] = Array.isArray(data.fundIds) ? data.fundIds : [];
    const shouldSupervise = requested.has(doc.id);
    const alreadySupervises = currentFundIds.includes(fundId);
    if (shouldSupervise === alreadySupervises) continue;

    const nextFundIds = shouldSupervise
      ? [...currentFundIds, fundId]
      : currentFundIds.filter((id) => id !== fundId);

    const update: Record<string, unknown> = { fundIds: nextFundIds, updatedAt: Date.now() };

    if (shouldSupervise && data.role !== 'fundManager') {
      update.role = 'fundManager';
      promoted.push(doc.id);
    }

    batch.update(doc.ref, update);
  }

  await batch.commit();

  // Claims drive the security rules, so they must follow the role change.
  for (const uid of promoted) {
    await auth.setCustomUserClaims(uid, { role: 'fundManager' });
  }

  await writeAuditLog(db, {
    adminId: request.auth!.uid,
    action: 'fund.setSupervisors',
    entity: 'fund',
    entityId: fundId,
    fundId,
    details: { supervisors: uids, promoted },
  });

  return { ok: true, promoted };
});
