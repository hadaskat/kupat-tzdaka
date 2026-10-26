import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, getAuth } from '../admin';
import { writeAuditLog } from '../audit/auditLog';
import { normalizeUsername, isValidUsername, usernameToSyntheticEmail } from '../utils/username';

/**
 * Renames the signed-in user. The Auth address is derived from the username,
 * so it has to move too - which only the Admin SDK can do.
 *
 * The client re-authenticates before calling this; here we still verify the
 * caller is changing their OWN username and that the new one is free.
 */
export const changeUsername = onCall<{ newUsername: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות');
  }

  const uid = request.auth.uid;
  const raw = request.data?.newUsername ?? '';
  const username = normalizeUsername(raw);

  if (!isValidUsername(username)) {
    throw new HttpsError(
      'invalid-argument',
      'שם המשתמש יכול להכיל אותיות (עברית או אנגלית), ספרות, נקודה, מקף וקו תחתון (2-30 תווים)'
    );
  }

  const db = getFirestore();
  const auth = getAuth();

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'המשתמש לא נמצא');
  }

  const oldUsername = userSnap.data()?.username as string | undefined;
  if (oldUsername === username) {
    return { ok: true };
  }

  const newUsernameRef = db.collection('usernames').doc(username);

  // Claim the new name atomically so two people can't take it at once.
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(newUsernameRef);
    if (existing.exists) {
      throw new HttpsError('already-exists', 'שם המשתמש כבר תפוס');
    }
    tx.set(newUsernameRef, { uid, createdAt: Date.now() });
  });

  try {
    await auth.updateUser(uid, { email: usernameToSyntheticEmail(username) });
    await userRef.update({ username, updatedAt: Date.now() });
    if (oldUsername) {
      await db.collection('usernames').doc(oldUsername).delete().catch(() => undefined);
    }
  } catch (error) {
    // Release the claim so a failed rename doesn't burn the name.
    await newUsernameRef.delete().catch(() => undefined);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'שינוי שם המשתמש נכשל');
  }

  await writeAuditLog(db, {
    adminId: uid,
    action: 'user.changeUsername',
    entity: 'user',
    entityId: uid,
    details: { from: oldUsername ?? null, to: username },
  });

  return { ok: true };
});
