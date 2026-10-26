import { normalizeHebrewText } from '../utils/textNormalize';

export interface MatchableFund {
  id: string;
  name: string;
}

export interface FundMatch {
  fundId: string;
  confidence: number;
}

/**
 * Nedarim Plus returns the shiur name in the `Groupe` field, and those names
 * are the fund names - so the match is exact and certain. No separate keyword
 * list is needed; the fund's own name is the key.
 */
export function matchFundByName(groupe: string | undefined, funds: MatchableFund[]): FundMatch | null {
  const normalized = normalizeHebrewText(groupe ?? '');
  if (!normalized) return null;

  const found = funds.find((f) => normalizeHebrewText(f.name) === normalized);
  return found ? { fundId: found.id, confidence: 1 } : null;
}

/**
 * Fallback for bank/credit-card files, where there is no structured category -
 * only whatever the payer typed. A fund name appearing inside that free text is
 * a strong hint, but not a certainty, so it is scored lower and the caller
 * routes it through the manual review queue.
 */
export function matchFundInFreeText(
  rawMessage: string,
  funds: MatchableFund[]
): FundMatch | null {
  const normalizedMessage = normalizeHebrewText(rawMessage);
  if (!normalizedMessage) return null;

  for (const fund of funds) {
    const normalizedName = normalizeHebrewText(fund.name);
    if (normalizedName && normalizedMessage.includes(normalizedName)) {
      return { fundId: fund.id, confidence: 0.7 };
    }
  }
  return null;
}
