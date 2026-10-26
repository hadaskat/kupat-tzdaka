import { useEffect, useState } from 'react';
import { collection, doc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import type { Donation, ImportedFile, ImportSourceType } from '../types/models';

export function useImportedFiles() {
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'importedFiles'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setFiles(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ImportedFile));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { files, loading };
}

export function useImportedFile(fileId: string | undefined) {
  const [file, setFile] = useState<ImportedFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileId) {
      setFile(null);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'importedFiles', fileId),
      (snap) => {
        setFile(snap.exists() ? ({ id: snap.id, ...snap.data() } as ImportedFile) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [fileId]);

  return { file, loading };
}

export function useDonationsForFile(fileId: string | undefined) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fileId) {
      setDonations([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'donations'),
      where('importedFileId', '==', fileId),
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
  }, [fileId]);

  return { donations, loading };
}

/**
 * Every donation awaiting a decision, whatever brought it in - Nedarim Plus,
 * a bank file, or manual entry. Ordered oldest first so the backlog is worked
 * through in the order the money actually arrived.
 */
export function usePendingDonations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'donations'),
      where('status', 'in', ['pendingMatch', 'matched']),
      orderBy('transactionDate', 'asc')
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
  }, []);

  return { donations, loading };
}

export async function uploadImportFile(params: {
  blob: Blob;
  fileName: string;
  sourceType: ImportSourceType;
  uploadedBy: string;
}) {
  const { blob, fileName, sourceType, uploadedBy } = params;
  const path = `imports/${uploadedBy}/${Date.now()}_${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    customMetadata: { sourceType, uploadedBy },
  });
  return path;
}

interface ConfirmOverrides {
  fundId?: string;
  personId?: string;
}

export function confirmDonation(donationId: string, overrides: ConfirmOverrides = {}) {
  const fn = httpsCallable(functions, 'confirmDonationMatch');
  return fn({ donationId, ...overrides });
}

export function bulkConfirmDonations(donationIds: string[]) {
  const fn = httpsCallable<{ donationIds: string[] }, { confirmed: string[]; failed: unknown[] }>(
    functions,
    'bulkConfirmDonations'
  );
  return fn({ donationIds });
}

export function rejectDonation(donationId: string) {
  const fn = httpsCallable(functions, 'rejectDonationMatch');
  return fn({ donationId });
}
