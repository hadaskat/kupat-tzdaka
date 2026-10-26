import type { Firestore } from 'firebase-admin/firestore';

export const SYNC_STATE_DOC = 'integrations/nedarimPlus';

export interface NedarimSyncState {
  /** Their TransactionId of the last row we ingested; the cursor for next time. */
  lastTransactionId: string | null;
  lastSyncAt: number | null;
  lastSyncBy: string | null;
  lastResult: {
    fetched: number;
    created: number;
    duplicates: number;
    skipped: number;
    unmatchedFund: number;
    usd: number;
    missingDate: number;
  } | null;
  lastError: string | null;
}

export const EMPTY_SYNC_STATE: NedarimSyncState = {
  lastTransactionId: null,
  lastSyncAt: null,
  lastSyncBy: null,
  lastResult: null,
  lastError: null,
};

export async function readSyncState(db: Firestore): Promise<NedarimSyncState> {
  const snap = await db.doc(SYNC_STATE_DOC).get();
  if (!snap.exists) return EMPTY_SYNC_STATE;
  return { ...EMPTY_SYNC_STATE, ...(snap.data() as Partial<NedarimSyncState>) };
}

export async function writeSyncState(
  db: Firestore,
  state: Partial<NedarimSyncState>
): Promise<void> {
  await db.doc(SYNC_STATE_DOC).set({ ...state }, { merge: true });
}
