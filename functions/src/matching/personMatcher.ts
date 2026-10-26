import { normalizeHebrewText } from '../utils/textNormalize';

export interface MatchablePerson {
  id: string;
  fullName: string;
}

/**
 * Exact match only (after normalization) - anything looser risks silently
 * crediting the wrong person's donation, so ambiguous names are left
 * unlinked for the admin to resolve manually during import review.
 */
export function matchPerson(
  counterpartyName: string | undefined,
  people: MatchablePerson[]
): string | null {
  if (!counterpartyName) return null;
  const normalized = normalizeHebrewText(counterpartyName);
  if (!normalized) return null;

  const found = people.find((p) => normalizeHebrewText(p.fullName) === normalized);
  return found?.id ?? null;
}
