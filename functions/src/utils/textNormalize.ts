// Strips Hebrew niqqud/punctuation (both are outside \p{L}/\p{N}/\s) and
// normalizes whitespace/case so payment messages and fund names can be
// compared reliably regardless of how the bank/credit-card export formatted them.
export function normalizeHebrewText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
