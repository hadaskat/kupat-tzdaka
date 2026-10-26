import { describe, test, expect } from 'vitest';
import { splitDonation, commissionApplies } from '../functions/src/ledger/commission';

// Spec §5: the operating commission applies only when the donor picked the
// fund themselves in the app / Nedarim Plus.
describe('commissionApplies', () => {
  test('applies to Nedarim Plus donations', () => {
    expect(commissionApplies('nedarimPlus')).toBe(true);
  });

  test('does NOT apply to bank, credit-card, manual or pledge donations', () => {
    expect(commissionApplies('bankImport')).toBe(false);
    expect(commissionApplies('creditCardImport')).toBe(false);
    expect(commissionApplies('manualAdmin')).toBe(false);
    expect(commissionApplies('clientPledge')).toBe(false);
  });
});

describe('splitDonation', () => {
  test('splits a Nedarim Plus donation 95/5', () => {
    expect(splitDonation(1000, 'nedarimPlus', 5)).toEqual({
      grossAmount: 1000,
      netAmount: 950,
      feeAmount: 50,
    });
  });

  test('bank donations keep 100% and take no fee', () => {
    expect(splitDonation(1000, 'bankImport', 5)).toEqual({
      grossAmount: 1000,
      netAmount: 1000,
      feeAmount: 0,
    });
  });

  test('honours a configured percentage other than 5', () => {
    expect(splitDonation(200, 'nedarimPlus', 10)).toEqual({
      grossAmount: 200,
      netAmount: 180,
      feeAmount: 20,
    });
  });

  test('a zero percentage disables the split entirely', () => {
    expect(splitDonation(500, 'nedarimPlus', 0)).toEqual({
      grossAmount: 500,
      netAmount: 500,
      feeAmount: 0,
    });
  });

  test('net + fee always reconstructs the gross exactly, even on awkward amounts', () => {
    // The receipt is issued on the gross, so rounding drift would be a real
    // accounting discrepancy rather than a cosmetic one.
    for (const gross of [33.33, 99.99, 1, 7, 12345.67, 0.05]) {
      const { netAmount, feeAmount } = splitDonation(gross, 'nedarimPlus', 5);
      expect(Number((netAmount + feeAmount).toFixed(2))).toBe(Number(gross.toFixed(2)));
    }
  });

  test('rounds the fee to agorot rather than fractions of one', () => {
    const { feeAmount } = splitDonation(33.33, 'nedarimPlus', 5);
    expect(feeAmount).toBe(1.67);
  });
});
