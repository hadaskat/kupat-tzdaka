import { useEffect, useState } from 'react';
import { collection, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';
import type { Donation } from '../types/models';

interface AddManualDonationParams {
  fundId: string;
  amount: number;
  transactionDate: number;
  /** nedarimPlus donations carry the operating commission; manualAdmin do not. */
  source?: 'manualAdmin' | 'nedarimPlus';
  personId?: string;
  donorNameRaw?: string;
  createPersonIfMissing?: boolean;
  rawMessage?: string;
}

interface AddManualDonationResult {
  donationId: string;
  grossAmount: number;
  netAmount: number;
  feeAmount: number;
  balanceAfter: number;
}

export function addManualDonation(params: AddManualDonationParams) {
  const fn = httpsCallable<AddManualDonationParams, AddManualDonationResult>(
    functions,
    'addManualDonation'
  );
  return fn(params);
}

interface CreatePledgeParams {
  fundId: string;
  amount: number;
  donorNameRaw: string;
  rawMessage?: string;
}

// A pledge is an intent to give - it deliberately never touches fund.balance.
// Only donations confirmed from a real bank/credit-card record move money.
export async function createPledge({ fundId, amount, donorNameRaw, rawMessage }: CreatePledgeParams) {
  const now = Date.now();
  return addDoc(collection(db, 'donations'), {
    fundId,
    personId: null,
    clientUserId: auth.currentUser?.uid ?? null,
    donorNameRaw,
    // A pledge never carries a commission: no money has moved yet, and the
    // split is computed when the real payment is confirmed.
    grossAmount: amount,
    netAmount: amount,
    feeAmount: 0,
    currency: 'ILS',
    transactionDate: now,
    source: 'clientPledge',
    rawMessage: rawMessage ?? null,
    status: 'pledged',
    dedupeKey: `pledge-${auth.currentUser?.uid}-${now}`,
    createdAt: now,
  });
}

export function useMyPledges(userId: string | null) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDonations([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'donations'),
      where('clientUserId', '==', userId),
      orderBy('transactionDate', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setDonations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Donation));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { donations, loading };
}

// Per-person donation history lives in api/people.ts (usePersonDonations),
// alongside the rest of the unified card's data.
