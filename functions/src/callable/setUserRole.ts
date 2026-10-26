import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, getAuth } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import type { UserRole } from '../types';

const VALID_ROLES: UserRole[] = ['superAdmin', 'fundManager', 'client'];

interface SetUserRoleRequest {
  uid: string;
  role: UserRole;
  /** Funds a fundManager may supervise. Ignored for other roles. */
  fundIds?: string[];
}

/**
 * Super-admin only: sets a user's role and keeps the custom claim in sync with
 * users/{uid}.role (the only path allowed to change that field - firestore.rules
 * blocks direct client writes to it).
 */
export const setUserRole = onCall<SetUserRoleRequest>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לשנות הרשאות משתמש');

  const { uid, role, fundIds } = request.data ?? {};
  if (!uid || !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'נדרש uid ותפקיד תקין');
  }
  if (uid === request.auth!.uid && role !== 'superAdmin') {
    throw new HttpsError(
      'failed-precondition',
      'לא ניתן להוריד לעצמך את הרשאת מנהל־על. יש לבקש זאת ממנהל־על אחר.'
    );
  }

  const auth = getAuth();
  const db = getFirestore();
  const scopedFundIds = role === 'fundManager' ? (fundIds ?? []) : [];

  await auth.setCustomUserClaims(uid, { role });
  await db.collection('users').doc(uid).update({
    role,
    fundIds: scopedFundIds,
    updatedAt: Date.now(),
  });

  await writeAuditLog(db, {
    adminId: request.auth!.uid,
    action: 'user.setRole',
    entity: 'user',
    entityId: uid,
    details: { role, fundIds: scopedFundIds },
  });

  return { ok: true };
});

/**
 * Adjusts which funds an existing fundManager may supervise, without touching
 * their role.
 */
export const setFundPermissions = onCall<{ uid: string; fundIds: string[] }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לשנות שיוך קרנות');

  const { uid, fundIds } = request.data ?? {};
  if (!uid || !Array.isArray(fundIds)) {
    throw new HttpsError('invalid-argument', 'נדרש uid ורשימת קרנות');
  }

  const db = getFirestore();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'המשתמש לא נמצא');
  }
  if (userSnap.data()?.role !== 'fundManager') {
    throw new HttpsError('failed-precondition', 'שיוך קרנות רלוונטי רק למנהל קרן');
  }

  await db.collection('users').doc(uid).update({ fundIds, updatedAt: Date.now() });

  await writeAuditLog(db, {
    adminId: request.auth!.uid,
    action: 'user.setFundPermissions',
    entity: 'user',
    entityId: uid,
    details: { fundIds },
  });

  return { ok: true };
});
