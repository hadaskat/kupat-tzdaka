import { describe, test, expect } from 'vitest';
import {
  normalizeUsername,
  isValidUsername,
  usernameToSyntheticEmail,
} from '../functions/src/utils/username';

/**
 * The Firebase Auth address is derived from the username by hashing it, and the
 * SAME derivation is reimplemented client-side in src/utils/username.ts (using
 * expo-crypto, which is TextEncoder -> crypto.subtle.digest('SHA-256') -> hex).
 *
 * If the two drift apart, logins fail silently - the account simply appears not
 * to exist. These pinned digests make any change to normalization or hashing
 * fail loudly here instead.
 */
describe('usernameToSyntheticEmail', () => {
  test('Hebrew username maps to a fixed ASCII address', () => {
    expect(usernameToSyntheticEmail('מנהל')).toBe(
      'udad89b6388f49be8fecb08fe28bf9559@kupat-tzedaka.internal'
    );
  });

  test('the local part is always valid ASCII, whatever the script', () => {
    for (const name of ['מנהל', 'מפקח', 'ישראל.ישראלי', 'admin1', 'שם-עם-מקף']) {
      const email = usernameToSyntheticEmail(name);
      const localPart = email.split('@')[0];
      expect(localPart).toMatch(/^u[0-9a-f]{32}$/);
    }
  });

  test('case and surrounding whitespace do not create separate accounts', () => {
    expect(usernameToSyntheticEmail('  Admin1  ')).toBe(usernameToSyntheticEmail('admin1'));
  });

  test('different usernames map to different addresses', () => {
    expect(usernameToSyntheticEmail('מנהל')).not.toBe(usernameToSyntheticEmail('מפקח'));
  });
});

describe('normalizeUsername', () => {
  test('trims, lowercases and applies NFKC', () => {
    expect(normalizeUsername('  ShimOn  ')).toBe('shimon');
    // NFKC folds the presentation form of alef-lamed into its plain letters.
    expect(normalizeUsername('ﭏ')).toBe('אל');
  });
});

describe('isValidUsername', () => {
  test('accepts Hebrew, Latin, digits and the allowed separators', () => {
    for (const name of ['מנהל', 'מפקח', 'admin1', 'israel.israeli', 'שם-עם-מקף', 'a_b']) {
      expect(isValidUsername(name)).toBe(true);
    }
  });

  test('rejects empty, too short, too long and spaced names', () => {
    expect(isValidUsername('')).toBe(false);
    expect(isValidUsername('א')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
    // A space would make the name ambiguous to type and to match.
    expect(isValidUsername('מנהל ראשי')).toBe(false);
  });

  test('rejects characters that would break the email or the URL', () => {
    for (const name of ['a@b', 'a/b', 'a b', 'a\\b', 'a#b']) {
      expect(isValidUsername(name)).toBe(false);
    }
  });
});
