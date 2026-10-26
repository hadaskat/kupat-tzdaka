import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LedgerEntry } from '../types/models';

export function useFundLedger(fundId: string | undefined, pageSize = 20) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fundId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'funds', fundId, 'ledger'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LedgerEntry));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [fundId, pageSize]);

  return { entries, loading };
}
