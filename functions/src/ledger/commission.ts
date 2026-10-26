import type { DonationSource } from '../types';

export interface DonationSplit {
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
}

/**
 * The operating commission applies ONLY when the donor themselves picked the
 * fund in the app and paid through Nedarim Plus (spec §5).
 *
 * Bank transfers, credit-card files and manually recorded donations arrive
 * without an up-front designation - the super admin assigns the fund - so
 * charging a commission on them was explicitly ruled out.
 */
export function commissionApplies(source: DonationSource): boolean {
  return source === 'nedarimPlus';
}

/**
 * Splits a donation into the slice credited to the designated fund and the
 * slice routed to the general/operating fund. Rounded to agorot so the two
 * parts always add back up to the gross exactly - the receipt is issued on
 * the gross, so any rounding drift would be a real accounting discrepancy.
 */
export function splitDonation(
  grossAmount: number,
  source: DonationSource,
  commissionPercentage: number
): DonationSplit {
  if (!commissionApplies(source) || commissionPercentage <= 0) {
    return { grossAmount, netAmount: grossAmount, feeAmount: 0 };
  }

  const feeAmount = Math.round(grossAmount * (commissionPercentage / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;
  return { grossAmount, netAmount, feeAmount };
}
