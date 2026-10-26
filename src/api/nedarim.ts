import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { NedarimSyncState, NedarimSyncSummary } from '../types/models';

const EMPTY: NedarimSyncState = {
  lastTransactionId: null,
  lastSyncAt: null,
  lastSyncBy: null,
  lastResult: null,
  lastError: null,
};

export function useNedarimSyncState() {
  const [state, setState] = useState<NedarimSyncState>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'integrations', 'nedarimPlus'),
      (snap) => {
        setState(snap.exists() ? { ...EMPTY, ...(snap.data() as Partial<NedarimSyncState>) } : EMPTY);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { state, loading };
}

/** Pulls everything new since the stored cursor. Safe to run repeatedly. */
export function syncNedarimPlus() {
  return httpsCallable<void, NedarimSyncSummary>(functions, 'syncNedarimPlus')();
}
