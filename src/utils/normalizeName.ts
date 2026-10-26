/**
 * Mirrors the server-side normalizeHebrewText so that searchName values built
 * on the client match the ones written by Cloud Functions. Strips punctuation
 * and Hebrew niqqud, collapses whitespace, lowercases.
 */
export function normalizeName(text: string): string {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
