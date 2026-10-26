import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, getAuth } from '../admin';
import { normalizeUsername, isValidUsername, usernameToSyntheticEmail } from '../utils/username';

interface RegisterUserRequest {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
}

export const registerUser = onCall<RegisterUserRequest>(async (request) => {
  const { username: rawUsername, password, fullName, phone } = request.data ?? {};

  if (!rawUsername || !password || !fullName) {
    throw new HttpsError('invalid-argument', 'חסרים שדות חובה: שם משתמש, סיסמה ושם מלא');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'הסיסמה חייבת להכיל לפחות 6 תווים');
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

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists) {
      throw new HttpsError('already-exists', 'שם המשתמש כבר תפוס');
    }
    tx.set(usernameRef, { reserved: true, createdAt: Date.now() });
  });

  try {
    const userRecord = await auth.createUser({
      email: usernameToSyntheticEmail(username),
      password,
      displayName: fullName,
    });

    await auth.setCustomUserClaims(userRecord.uid, { role: 'client' });

    const now = Date.now();
    await Promise.all([
      usernameRef.set({ uid: userRecord.uid, createdAt: now }),
      db.collection('users').doc(userRecord.uid).set({
        role: 'client',
        username,
        fullName,
        phone: phone ?? null,
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    ]);

    return { uid: userRecord.uid };
  } catch (error) {
    await usernameRef.delete().catch(() => undefined);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'ההרשמה נכשלה, נסו שוב');
  }
});
