import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { writeLedgerEntry } from './ledgerService';
import { splitDonation } from './commission';
import type { DonationSource } from '../types';

export interface GeneralFundLookup {
  ref: DocumentReference;
  balance: number;
}

/**
 * Finds the fund that receives the operating commission. Returns null when no
 * general fund is configured - callers treat that as "no split possible".
 */
export async function findGeneralFund(db: Firestore): Promise<DocumentReference | null> {
  const byFlag = await db.collection('funds').where('isGeneralFund', '==', true).limit(1).get();
  return byFlag.empty ? null : byFlag.docs[0].ref;
}

interface PostDonationParams {
  db: Firestore;
  tx: Transaction;
  donationId: string;
  source: DonationSource;
  grossAmount: number;
  commissionPercentage: number;
  targetFundRef: DocumentReference;
  targetFundBalance: number;
  /** Required only when a commission is actually due. */
  generalFund: GeneralFundLookup | null;
  createdBy: string;
}

export interface PostedDonation {
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  targetBalanceAfter: number;
  generalBalanceAfter: number | null;
}

/**
 * Posts a confirmed donation to the ledger, splitting off the operating
 * commission when the source calls for it. Both slices are written as separate
 * entries linked to the same donation id so the split is always reconstructable
 * (spec §5.3). Must be called inside an open transaction, after all reads.
 */
export function postDonationToLedger(params: PostDonationParams): PostedDonation {
  const {
    db,
    tx,
    donationId,
    source,
    grossAmount,
    commissionPercentage,
    targetFundRef,
    targetFundBalance,
    generalFund,
    createdBy,
  } = params;

  const { netAmount, feeAmount } = splitDonation(grossAmount, source, commissionPercentage);

  if (feeAmount > 0 && !generalFund) {
    throw new HttpsError(
      'failed-precondition',
      'לא הוגדרה קרן כללית לקליטת עמלת התפעול. יש לסמן קרן אחת כ"קרן כללית" בהגדרות.'
    );
  }

  const targetBalanceAfter = writeLedgerEntry({
    db,
    tx,
    fundRef: targetFundRef,
    currentBalance: targetFundBalance,
    type: 'donationIn',
    amount: netAmount,
    relatedDonationId: donationId,
    createdBy,
  });

  let generalBalanceAfter: number | null = null;
  if (feeAmount > 0 && generalFund) {
    generalBalanceAfter = writeLedgerEntry({
      db,
      tx,
      fundRef: generalFund.ref,
      currentBalance: generalFund.balance,
      type: 'commissionIn',
      amount: feeAmount,
      relatedDonationId: donationId,
      createdBy,
      note: `עמלת תפעול ${commissionPercentage}% מתרומה על סך ${grossAmount}`,
    });
  }

  return { grossAmount, netAmount, feeAmount, targetBalanceAfter, generalBalanceAfter };
}
