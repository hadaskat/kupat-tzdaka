import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Firebase Secrets only resolve against a real cloud project, so on the local
 * emulator `secret.value()` comes back empty. To make the integration testable
 * before deploying, fall back to an environment variable - but ONLY when
 * actually running under the emulator, so a production misconfiguration can
 * never silently pick up a stray env var instead of the managed secret.
 */
export function isEmulator(): boolean {
  return !!process.env.FUNCTIONS_EMULATOR || !!process.env.FIRESTORE_EMULATOR_HOST;
}

export function resolveApiPassword(secretValue: string | undefined): string {
  if (secretValue) return secretValue;

  if (isEmulator()) {
    const fromEnv = process.env.NEDARIM_API_PASSWORD;
    if (fromEnv) return fromEnv;
    throw new HttpsError(
      'failed-precondition',
      'סיסמת ה-API לא הוגדרה. בפיתוח מקומי: הוסיפו NEDARIM_API_PASSWORD לקובץ functions/.env והפעילו מחדש את האמולטור.'
    );
  }

  throw new HttpsError(
    'failed-precondition',
    'סיסמת ה-API של נדרים פלוס לא הוגדרה בשרת. יש להגדירה עם: firebase functions:secrets:set NEDARIM_API_PASSWORD'
  );
}
