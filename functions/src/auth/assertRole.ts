import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Every state-changing operation is reserved for the super admin (spec §3).
 * fundManager is a supervisory, read-only role by design - it must never be
 * accepted here, otherwise the "two eyes" separation of duties collapses.
 */
export function assertSuperAdmin(role: unknown, message = 'רק מנהל־על יכול לבצע פעולה זו'): void {
  if (role !== 'superAdmin') {
    throw new HttpsError('permission-denied', message);
  }
}
