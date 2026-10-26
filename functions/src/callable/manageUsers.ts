import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, getAuth } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { normalizeUsername, isValidUsername, usernameToSyntheticEmail } from '../utils/username';
import type { UserRole } from '../types';

const VALID_ROLES: UserRole[] = ['superAdmin', 'fundManager', 'client'];

interface CreateUserRequest {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  fundIds?: string[];
}

/**
 * Lets a super admin create an account directly, rather than waiting for the
 * person to self-register. This is how supervisors and additional admins get
 * onboarded.
 */
export const createUserByAdmin = onCall<CreateUserRequest>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול ליצור משתמש');

  const { username: rawUsername, password, fullName, phone, role, fundIds } = request.data ?? {};

  if (!rawUsername || !password || !fullName?.trim()) {
    throw new HttpsError('invalid-argument', 'נדרשים שם משתמש, סיסמה ושם מלא');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'הסיסמה חייבת להכיל לפחות 6 תווים');
  }
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'תפקיד לא תקין');
  }

  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    throw new HttpsError(
      'invalid-argument',
      'שם המשתמש יכול להכיל אותיות (עברית או אנגלית), ספרות, נקודה, מקף וקו תחתון (2-30 תווים)'
    );
  }

  const db = getFirestore();
  const auth = getAuth();
  const usernameRef = db.collection('usernames').doc(username);

  // Claim the name first so two admins can't create the same one at once.
  await db.runTransaction(async (tx) => {
    if ((await tx.get(usernameRef)).exists) {
      throw new HttpsError('already-exists', 'שם המשתמש כבר תפוס');
    }
    tx.set(usernameRef, { reserved: true, createdAt: Date.now() });
  });

  try {
    const userRecord = await auth.createUser({
      email: usernameToSyntheticEmail(username),
      password,
      displayName: fullName.trim(),
    });
    await auth.setCustomUserClaims(userRecord.uid, { role });

    const now = Date.now();
    const scopedFundIds = role === 'fundManager' ? (fundIds ?? []) : [];
    await Promise.all([
      usernameRef.set({ uid: userRecord.uid, createdAt: now }),
      db.collection('users').doc(userRecord.uid).set({
        role,
        username,
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        fundIds: scopedFundIds,
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    ]);

    await writeAuditLog(db, {
      adminId: request.auth!.uid,
      action: 'user.create',
      entity: 'user',
      entityId: userRecord.uid,
      details: { username, role },
    });

    return { uid: userRecord.uid };
  } catch (error) {
    await usernameRef.delete().catch(() => undefined);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'יצירת המשתמש נכשלה');
  }
});

/**
 * Deletes a login account. Financial records (donations, support requests,
 * ledger entries) are deliberately left untouched - they are the books, and
 * removing them because someone's login was deleted would corrupt history.
 */
export const deleteUserByAdmin = onCall<{ uid: string }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול למחוק משתמש');

  const { uid } = request.data ?? {};
  if (!uid) {
    throw new HttpsError('invalid-argument', 'נדרש מזהה משתמש');
  }
  if (uid === request.auth!.uid) {
    throw new HttpsError('failed-precondition', 'לא ניתן למחוק את המשתמש שלך');
  }

  const db = getFirestore();
  const auth = getAuth();

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'המשתמש לא נמצא');
  }
  const data = snap.data()!;

  // Never leave the system without an administrator.
  if (data.role === 'superAdmin') {
    const admins = await db.collection('users').where('role', '==', 'superAdmin').get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'לא ניתן למחוק את מנהל־העל האחרון');
    }
  }

  await auth.deleteUser(uid).catch(() => undefined);
  if (data.username) {
    await db.collection('usernames').doc(data.username as string).delete().catch(() => undefined);
  }
  await userRef.delete();

  await writeAuditLog(db, {
    adminId: request.auth!.uid,
    action: 'user.delete',
    entity: 'user',
    entityId: uid,
    details: { username: data.username ?? null, role: data.role ?? null },
  });

  return { ok: true };
});
