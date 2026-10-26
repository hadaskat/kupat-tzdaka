import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import { normalizeHebrewText } from '../utils/textNormalize';

export const PEOPLE = 'people';

/** Lookup key for a person's name - also what duplicate detection compares. */
export function buildSearchName(fullName: string): string {
  return normalizeHebrewText(fullName);
}

export interface NewPersonInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  idNumber?: string | null;
  address?: string | null;
  notes?: string | null;
  isDonor?: boolean;
  isBeneficiary?: boolean;
  linkedUserId?: string | null;
}

export function buildPersonDoc(input: NewPersonInput) {
  const now = Date.now();
  return {
    fullName: input.fullName,
    searchName: buildSearchName(input.fullName),
    phone: input.phone ?? null,
    email: input.email ?? null,
    idNumber: input.idNumber ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    isDonor: input.isDonor ?? false,
    isBeneficiary: input.isBeneficiary ?? false,
    linkedUserId: input.linkedUserId ?? null,
    totalDonated: 0,
    totalReceived: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Finds an existing person by exact normalized name. Deliberately exact:
 * anything looser risks crediting money to the wrong person, so ambiguous
 * names are left for the admin to resolve by hand.
 */
export async function findPersonByName(
  db: Firestore,
  fullName: string
): Promise<DocumentReference | null> {
  const searchName = buildSearchName(fullName);
  if (!searchName) return null;

  const snap = await db.collection(PEOPLE).where('searchName', '==', searchName).limit(1).get();
  return snap.empty ? null : snap.docs[0].ref;
}

/**
 * Credits a donation to a person inside an open transaction. `personSnap` must
 * already have been read by the caller (Firestore requires all reads first).
 */
export function creditDonation(
  tx: Transaction,
  personRef: DocumentReference,
  personExists: boolean,
  currentTotal: number,
  amount: number,
  fallback?: NewPersonInput
): void {
  if (personExists) {
    tx.update(personRef, {
      totalDonated: currentTotal + amount,
      isDonor: true,
      updatedAt: Date.now(),
    });
    return;
  }
  if (!fallback) return;
  tx.set(personRef, { ...buildPersonDoc({ ...fallback, isDonor: true }), totalDonated: amount });
}

export function creditSupport(
  tx: Transaction,
  personRef: DocumentReference,
  currentTotal: number,
  amount: number
): void {
  tx.update(personRef, {
    totalReceived: currentTotal + amount,
    isBeneficiary: true,
    updatedAt: Date.now(),
  });
}
