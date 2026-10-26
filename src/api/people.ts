import { useEffect, useMemo, useState } from 'react';
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
import { db } from '../config/firebase';
import { normalizeName } from '../utils/normalizeName';
import type { Person, Donation, SupportRequest } from '../types/models';

const peopleCollection = collection(db, 'people');

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(peopleCollection, orderBy('fullName')),
      (snap) => {
        setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Person));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { people, loading };
}

export type PeopleFilter = 'all' | 'donors' | 'beneficiaries';

/**
 * Free-text search across name, phone and ID number (spec §4.7). Filtering
 * happens client-side: the card list is small enough that a Firestore
 * prefix-index would add complexity without a real benefit.
 */
export function useSearchPeople(term: string, filter: PeopleFilter = 'all') {
  const { people, loading } = usePeople();

  const results = useMemo(() => {
    const normalized = normalizeName(term);
    return people.filter((p) => {
      if (filter === 'donors' && !p.isDonor) return false;
      if (filter === 'beneficiaries' && !p.isBeneficiary) return false;
      if (!normalized) return true;
      return (
        (p.searchName ?? normalizeName(p.fullName)).includes(normalized) ||
        (p.phone ?? '').includes(term.trim()) ||
        (p.idNumber ?? '').includes(term.trim())
      );
    });
  }, [people, term, filter]);

  return { people: results, loading };
}

export function usePerson(personId: string | undefined) {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'people', personId),
      (snap) => {
        setPerson(snap.exists() ? ({ id: snap.id, ...snap.data() } as Person) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [personId]);

  return { person, loading };
}

/** Every donation credited to this person, across all funds. */
export function usePersonDonations(personId: string | undefined) {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) {
      setDonations([]);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'donations'),
        where('personId', '==', personId),
        orderBy('transactionDate', 'desc')
      ),
      (snap) => {
        setDonations(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Donation));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [personId]);

  return { donations, loading };
}

/** Every support request paid out to this person. */
export function usePersonSupportRequests(personId: string | undefined) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'supportRequests'),
        where('personId', '==', personId),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportRequest));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [personId]);

  return { requests, loading };
}

interface CreatePersonParams {
  fullName: string;
  phone?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  notes?: string;
  isDonor?: boolean;
  isBeneficiary?: boolean;
}

export async function createPerson(params: CreatePersonParams) {
  const now = Date.now();
  return addDoc(peopleCollection, {
    fullName: params.fullName,
    searchName: normalizeName(params.fullName),
    // Firestore rejects undefined, and blank optional form fields arrive as undefined.
    phone: params.phone ?? null,
    email: params.email ?? null,
    idNumber: params.idNumber ?? null,
    address: params.address ?? null,
    notes: params.notes ?? null,
    isDonor: params.isDonor ?? false,
    isBeneficiary: params.isBeneficiary ?? false,
    linkedUserId: null,
    totalDonated: 0,
    totalReceived: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updatePerson(personId: string, changes: Partial<CreatePersonParams>) {
  const patch: Record<string, unknown> = { ...changes, updatedAt: Date.now() };
  if (changes.fullName) patch.searchName = normalizeName(changes.fullName);
  return updateDoc(doc(db, 'people', personId), patch);
}
