import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { PEOPLE, findPersonByName, buildPersonDoc } from '../people/peopleService';
import { buildDedupeKey } from '../utils/dedupe';

/**
 * Fund list for the public donation screen (spec §6.1).
 *
 * Served through a callable rather than a direct Firestore read so that
 * balances stay private - security rules are per-document, so opening `funds`
 * to unauthenticated reads would expose every fund's balance.
 */
export const listPublicFunds = onCall(async () => {
  const db = getFirestore();
  const snap = await db.collection('funds').where('active', '==', true).get();

  return {
    funds: snap.docs
      // The operating fund is an internal bucket, not something to donate to.
      .filter((d) => d.data().isGeneralFund !== true)
      .map((d) => ({
        id: d.id,
        name: d.data().name as string,
        description: (d.data().description as string) ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
  };
});

interface GuestDonationRequest {
  fundId: string;
  amount: number;
  fullName: string;
  phone?: string;
  email?: string;
  isRecurring?: boolean;
  note?: string;
}

const MAX_GUEST_AMOUNT = 1_000_000;

/**
 * Records a guest's intent to donate (spec §6.1). Callable without auth.
 *
 * Deliberately does NOT touch any fund balance: the money only exists once
 * Nedarim Plus confirms the payment, at which point the webhook flips this
 * record to confirmed and the commission split is applied. Until then it is a
 * pledge, exactly like a signed-in client's pledge.
 */
export const createGuestDonation = onCall<GuestDonationRequest>(async (request) => {
  const { fundId, amount, fullName, phone, email, isRecurring, note } = request.data ?? {};

  if (!fundId || !fullName?.trim()) {
    throw new HttpsError('invalid-argument', 'נדרשים בחירת קרן ושם מלא');
  }
  if (!amount || amount <= 0 || amount > MAX_GUEST_AMOUNT) {
    throw new HttpsError('invalid-argument', 'סכום התרומה אינו תקין');
  }
  // Needed to send the receipt - a section 46 receipt without a way to deliver
  // it is useless to the donor.
  if (!phone?.trim() && !email?.trim()) {
    throw new HttpsError('invalid-argument', 'נדרש טלפון או דוא״ל לצורך משלוח הקבלה');
  }

  const db = getFirestore();
  const fundSnap = await db.collection('funds').doc(fundId).get();
  if (!fundSnap.exists || fundSnap.data()?.active !== true) {
    throw new HttpsError('not-found', 'הקרן שנבחרה אינה זמינה');
  }

  // Reuse the donor's existing card when we already know them, so a repeat
  // guest donor doesn't fragment into several records (spec §4.7).
  const existingPerson = await findPersonByName(db, fullName);
  const personRef = existingPerson ?? db.collection(PEOPLE).doc();
  if (!existingPerson) {
    await personRef.set(
      buildPersonDoc({
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        isDonor: true,
      })
    );
  }

  const now = Date.now();
  const donationRef = await db.collection('donations').add({
    fundId,
    personId: personRef.id,
    clientUserId: null,
    donorNameRaw: fullName.trim(),
    guestContact: { phone: phone?.trim() || null, email: email?.trim() || null },
    isRecurring: !!isRecurring,
    // The split is computed at confirmation, once the payment is real.
    grossAmount: amount,
    netAmount: amount,
    feeAmount: 0,
    currency: 'ILS',
    transactionDate: now,
    source: 'nedarimPlus',
    rawMessage: note?.trim() || null,
    status: 'pledged',
    dedupeKey: buildDedupeKey({
      transactionDate: now,
      amount,
      rawMessage: note,
      source: 'nedarimPlus',
    }),
    createdAt: now,
  });

  return { donationId: donationRef.id, personId: personRef.id };
});
