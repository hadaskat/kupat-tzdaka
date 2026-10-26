import { useEffect, useState } from 'react';
import { collection, doc, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { SupportRequest, SupportRequestType } from '../types/models';

const requestsCollection = collection(db, 'supportRequests');

export function useAllSupportRequests() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(requestsCollection, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { requests, loading };
}

export function useMySupportRequests(userId: string | null) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const q = query(
      requestsCollection,
      where('clientUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [userId]);

  return { requests, loading };
}

export function useSupportRequest(requestId: string | undefined) {
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'supportRequests', requestId),
      (snap) => {
        setRequest(snap.exists() ? ({ id: snap.id, ...snap.data() } as SupportRequest) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [requestId]);

  return { request, loading };
}

interface SubmitRequestParams {
  type: SupportRequestType;
  clientUserId: string;
  clientName: string;
  fundId: string;
  requestedAmount: number;
  reason: string;
}

export async function submitSupportRequest(params: SubmitRequestParams) {
  return addDoc(requestsCollection, {
    ...params,
    status: 'pending',
    createdAt: Date.now(),
  });
}

export function reviewSupportRequest(params: {
  requestId: string;
  decision: 'approved' | 'rejected';
  approvedAmount?: number;
  personId?: string;
  note?: string;
}) {
  return httpsCallable(functions, 'reviewSupportRequest')(params);
}

export function disburseSupportRequest(requestId: string, personId?: string, note?: string) {
  return httpsCallable(functions, 'disburseSupportRequest')({ requestId, personId, note });
}

export function recordLoanRepayment(requestId: string, amount: number, note?: string) {
  return httpsCallable(functions, 'recordLoanRepayment')({ requestId, amount, note });
}
