import * as Crypto from 'expo-crypto';

const USERNAME_EMAIL_DOMAIN = 'kupat-tzedaka.internal';

const USERNAME_PATTERN = /^[\p{L}\p{N}_.\-']{2,30}$/u;

/** Must match functions/src/utils/username.ts exactly. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}

/**
 * Derives the Firebase Auth address for a username. Hashed so that Hebrew
 * usernames still produce a valid ASCII email local part.
 *
 * MUST stay byte-for-byte identical to the server implementation in
 * functions/src/utils/username.ts, or logins will silently fail.
 */
export async function usernameToSyntheticEmail(username: string): Promise<string> {
  const normalized = normalizeUsername(username);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return `u${hash.slice(0, 32)}@${USERNAME_EMAIL_DOMAIN}`;
}
