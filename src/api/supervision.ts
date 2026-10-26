import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  documentId,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Fund, Donation, SupportRequest, AuditEntry } from '../types/models';

/** Firestore `in` queries accept at most 30 values, so scoped lists are chunked. */
const IN_CHUNK = 30;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Subscribes to exactly the funds a supervisor is allowed to see. Returns an
 * empty list (never "all funds") when no funds are assigned, so a
 * misconfigured account can't accidentally see everything.
 */
export function useSupervisedFunds(fundIds: string[]) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const key = fundIds.join(',');

  useEffect(() => {
    if (fundIds.length === 0) {
      setFunds([]);
      setLoading(false);
      return;
    }

    const groups = chunk(fundIds, IN_CHUNK);
    const partials: Fund[][] = groups.map(() => []);

    const unsubscribers = groups.map((group, index) =>
      onSnapshot(
        query(collection(db, 'funds'), where(documentId(), 'in', group)),
        (snap) => {
          partials[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Fund);
          setFunds(partials.flat().sort((a, b) => a.name.localeCompare(b.name, 'he')));
          setLoading(false);
        },
        () => setLoading(false)
      )
    );

    return () => unsubscribers.forEach((u) => u());
  }, [key]);

  return { funds, loading };
}

export function useSupervisedDonations(fundIds: string[], max = 50) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const key = fundIds.join(',');

  useEffect(() => {
    if (fundIds.length === 0) {
      setDonations([]);
      setLoading(false);
      return;
    }
    const groups = chunk(fundIds, IN_CHUNK);
    const partials: Donation[][] = groups.map(() => []);

    const unsubscribers = groups.map((group, index) =>
      onSnapshot(
        query(
          collection(db, 'donations'),
          where('fundId', 'in', group),
          where('status', '==', 'confirmed'),
          orderBy('transactionDate', 'desc'),
          limit(max)
        ),
        (snap) => {
          partials[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Donation);
          setDonations(
            partials.flat().sort((a, b) => b.transactionDate - a.transactionDate).slice(0, max)
          );
          setLoading(false);
        },
        () => setLoading(false)
      )
    );

    return () => unsubscribers.forEach((u) => u());
  }, [key, max]);

  return { donations, loading };
}

export function useSupervisedRequests(fundIds: string[], max = 50) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const key = fundIds.join(',');

  useEffect(() => {
    if (fundIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const groups = chunk(fundIds, IN_CHUNK);
    const partials: SupportRequest[][] = groups.map(() => []);

    const unsubscribers = groups.map((group, index) =>
      onSnapshot(
        query(
          collection(db, 'supportRequests'),
          where('fundId', 'in', group),
          orderBy('createdAt', 'desc'),
          limit(max)
        ),
        (snap) => {
          partials[index] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest);
          setRequests(partials.flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, max));
          setLoading(false);
        },
        () => setLoading(false)
      )
    );

    return () => unsubscribers.forEach((u) => u());
  }, [key, max]);

  return { requests, loading };
}

export function useAuditLog(fundIds: string[] | null, max = 100) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const key = fundIds ? fundIds.join(',') : 'all';

  useEffect(() => {
    // null = super admin (whole log); an array = supervisor scoped to their funds.
    if (fundIds && fundIds.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const base = collection(db, 'auditLog');
    const q = fundIds
      ? query(base, where('fundId', 'in', fundIds.slice(0, IN_CHUNK)), orderBy('timestamp', 'desc'), limit(max))
      : query(base, orderBy('timestamp', 'desc'), limit(max));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditEntry));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [key, max]);

  return { entries, loading };
}

export function useFundLedgerEntries(fundId: string | undefined, max = 50) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!fundId) {
      setEntries([]);
      return;
    }
    const unsubscribe = onSnapshot(
      query(collection(db, 'funds', fundId, 'ledger'), orderBy('createdAt', 'desc'), limit(max)),
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => undefined
    );
    return unsubscribe;
  }, [fundId, max]);

  return entries;
}
