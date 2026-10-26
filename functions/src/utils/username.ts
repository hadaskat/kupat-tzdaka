import { createHash } from 'crypto';

export const USERNAME_EMAIL_DOMAIN = 'kupat-tzedaka.internal';

// Hebrew letters, Latin letters, digits, and a few separators. Deliberately
// permissive about script so a Hebrew-speaking yeshiva can use Hebrew names.
const USERNAME_PATTERN = /^[\p{L}\p{N}_.\-']{2,30}$/u;

/**
 * Usernames are compared and stored in this form. NFKC folds visually
 * identical Unicode variants together so "משה" typed two different ways can't
 * become two different accounts.
 */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

/**
 * Firebase Auth only speaks email/password, and an email local part must be
 * ASCII - so a Hebrew username can't be embedded directly. Hashing the
 * normalized username gives a stable ASCII address with no lookup step and
 * without leaking the username itself. Uniqueness is still enforced
 * separately by the usernames/{username} collection.
 *
 * MUST stay byte-for-byte identical to the client implementation in
 * src/utils/username.ts, or logins will silently fail.
 */
export function usernameToSyntheticEmail(username: string): string {
  const normalized = normalizeUsername(username);
  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32);
  return `u${hash}@${USERNAME_EMAIL_DOMAIN}`;
}
