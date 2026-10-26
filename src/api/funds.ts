import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { Fund, Donation, SupportRequest } from '../types/models';

const fundsCollection = collection(db, 'funds');

export function useFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(fundsCollection, orderBy('name'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fund));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { funds, loading };
}

export function useFund(fundId: string | undefined) {
  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fundId) {
      setFund(null);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'funds', fundId),
      (snap) => {
        setFund(snap.exists() ? ({ id: snap.id, ...snap.data() } as Fund) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [fundId]);

  return { fund, loading };
}

/** Confirmed donations into this fund - money that actually arrived. */
export function useFundDonations(fundId: string | undefined) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fundId) {
      setDonations([]);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'donations'),
        where('fundId', '==', fundId),
        orderBy('transactionDate', 'desc')
      ),
      (snap) => {
        setDonations(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Donation)
            .filter((d) => d.status === 'confirmed')
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [fundId]);

  return { donations, loading };
}

/** Support payouts actually made from this fund. */
export function useFundSupportRequests(fundId: string | undefined) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fundId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'supportRequests'),
        where('fundId', '==', fundId),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setRequests(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as SupportRequest)
            .filter((r) => r.status === 'paid' || r.status === 'inRepayment' || r.status === 'closed')
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [fundId]);

  return { requests, loading };
}

interface CreateFundParams {
  name: string;
  description?: string;
  isGeneralFund?: boolean;
  createdBy: string;
}

export async function createFund({
  name,
  description,
  isGeneralFund,
  createdBy,
}: CreateFundParams) {
  const now = Date.now();
  return addDoc(fundsCollection, {
    name,
    description: description ?? '',
    isGeneralFund: isGeneralFund ?? false,
    balance: 0,
    currency: 'ILS',
    active: true,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

interface UpdateFundParams {
  name?: string;
  description?: string;
  isGeneralFund?: boolean;
  active?: boolean;
}

export async function updateFund(fundId: string, changes: UpdateFundParams) {
  return updateDoc(doc(db, 'funds', fundId), { ...changes, updatedAt: Date.now() });
}

export interface FundDeletionImpact {
  balance: number;
  ledgerEntries: number;
  donations: number;
  supportRequests: number;
}

/** What a permanent purge of this fund would destroy. */
export function getFundDeletionImpact(fundId: string) {
  return httpsCallable<{ fundId: string }, FundDeletionImpact>(
    functions,
    'getFundDeletionImpact'
  )({ fundId });
}

interface DeleteFundResult {
  purged: boolean;
  archived: boolean;
  deleted?: { ledgerEntries: number; donations: number; supportRequests: number };
}

/**
 * mode 'archive' keeps the records and requires the balance to be moved out
 * first; mode 'purge' erases the fund and everything attached to it (spec §4.2).
 */
export function deleteFund(
  fundId: string,
  options: { mode?: 'archive' | 'purge'; transferToFundId?: string } = {}
) {
  return httpsCallable<
    { fundId: string; mode?: 'archive' | 'purge'; transferToFundId?: string },
    DeleteFundResult
  >(functions, 'deleteFund')({ fundId, ...options });
}
