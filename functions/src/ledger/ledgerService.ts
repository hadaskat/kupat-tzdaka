import { HttpsError } from 'firebase-functions/v2/https';
import type { Transaction, DocumentReference, Firestore } from 'firebase-admin/firestore';

export type LedgerEntryType =
  | 'donationIn'
  | 'commissionIn'
  | 'donationReversal'
  | 'supportOut'
  | 'loanOut'
  | 'loanRepayment'
  | 'adjustment';

interface WriteLedgerEntryParams {
  db: Firestore;
  tx: Transaction;
  fundRef: DocumentReference;
  currentBalance: number;
  type: LedgerEntryType;
  amount: number; // signed: positive increases the fund balance, negative decreases it
  relatedDonationId?: string;
  relatedRequestId?: string;
  createdBy: string;
  note?: string;
  allowNegative?: boolean;
}

// Writes a single ledger entry + the resulting fund.balance inside an
// ALREADY-OPEN transaction. Every caller must have read fundRef (and any
// other documents it needs) via tx.get(...) before calling this, and must
// not perform any further tx.get(...) calls afterward - Firestore
// transactions require all reads before any writes.
export function writeLedgerEntry(params: WriteLedgerEntryParams): number {
  const { db, tx, fundRef, currentBalance, type, amount, allowNegative } = params;
  const balanceAfter = currentBalance + amount;

  if (balanceAfter < 0 && !allowNegative) {
    throw new HttpsError('failed-precondition', 'הפעולה תגרום ליתרה שלילית בקרן');
  }

  const ledgerRef = fundRef.collection('ledger').doc();
  const now = Date.now();

  tx.set(ledgerRef, {
    fundId: fundRef.id,
    type,
    amount,
    balanceAfter,
    relatedDonationId: params.relatedDonationId ?? null,
    relatedRequestId: params.relatedRequestId ?? null,
    createdBy: params.createdBy,
    createdAt: now,
    note: params.note ?? null,
  });
  tx.update(fundRef, { balance: balanceAfter, updatedAt: now });

  void db; // db is accepted for symmetry/future use (e.g. audit collections)
  return balanceAfter;
}

// Self-contained convenience wrapper for the common case: no other reads
// needed besides the fund itself (e.g. a plain balance adjustment).
export async function applyLedgerEntry(
  db: Firestore,
  params: Omit<WriteLedgerEntryParams, 'db' | 'tx' | 'currentBalance' | 'fundRef'> & { fundId: string }
): Promise<{ balanceAfter: number }> {
  const fundRef = db.collection('funds').doc(params.fundId);

  const balanceAfter = await db.runTransaction(async (tx) => {
    const fundSnap = await tx.get(fundRef);
    if (!fundSnap.exists) {
      throw new HttpsError('not-found', 'הקרן לא נמצאה');
    }
    const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
    return writeLedgerEntry({ ...params, db, tx, fundRef, currentBalance });
  });

  return { balanceAfter };
}
