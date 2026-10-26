import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { postDonationToLedger, findGeneralFund } from '../ledger/postDonation';
import { readOrgSettings } from '../org/orgSettings';
import { buildDedupeKey } from '../utils/dedupe';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { PEOPLE, findPersonByName, creditDonation } from '../people/peopleService';
import type { DonationSource } from '../types';

/**
 * Manual entry covers cash and bank transfers only. Nedarim Plus donations
 * arrive automatically through the webhook, so letting an admin key one in by
 * hand would just invite double-counting - hence no source parameter.
 */
interface AddManualDonationRequest {
  fundId: string;
  amount: number;
  transactionDate: number;
  personId?: string;
  donorNameRaw?: string;
  createPersonIfMissing?: boolean;
  rawMessage?: string;
}

export const addManualDonation = onCall<AddManualDonationRequest>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לרשום תרומה');

  const { fundId, amount, transactionDate, personId, donorNameRaw, createPersonIfMissing, rawMessage } =
    request.data ?? {};

  if (!fundId || !amount || amount <= 0 || !transactionDate) {
    throw new HttpsError('invalid-argument', 'נדרשים קרן, סכום חיובי ותאריך');
  }

  // Cash/transfer only - no operating commission is taken (spec §5).
  const source: DonationSource = 'manualAdmin';

  const db = getFirestore();
  const uid = request.auth!.uid;
  const now = Date.now();

  const orgSettings = await readOrgSettings(db);
  const generalFundRef = await findGeneralFund(db);

  const fundRef = db.collection('funds').doc(fundId);
  const donationRef = db.collection('donations').doc();

  // Reuse an existing person with the same name rather than creating a
  // duplicate card - the whole point of the unified כרטסת (spec §4.7).
  let personRef: FirebaseFirestore.DocumentReference | null = null;
  if (personId) {
    personRef = db.collection(PEOPLE).doc(personId);
  } else if (createPersonIfMissing && donorNameRaw) {
    personRef = (await findPersonByName(db, donorNameRaw)) ?? db.collection(PEOPLE).doc();
  }
  const isNewPerson = !!personRef && !personId && !(await personRef.get()).exists;

  const posted = await db.runTransaction(async (tx) => {
    const fundSnap = await tx.get(fundRef);
    if (!fundSnap.exists) {
      throw new HttpsError('not-found', 'הקרן לא נמצאה');
    }

    let personSnap = null;
    if (personRef && !isNewPerson) {
      personSnap = await tx.get(personRef);
      if (!personSnap.exists) {
        throw new HttpsError('not-found', 'התורם לא נמצא');
      }
    }

    // The general fund may be the same document as the target fund; reading it
    // twice in one transaction is fine, but the balances must not diverge.
    const isSameFund = generalFundRef?.id === fundRef.id;
    const generalSnap = generalFundRef && !isSameFund ? await tx.get(generalFundRef) : null;

    const targetFundBalance = (fundSnap.data()?.balance as number) ?? 0;
    const generalFund = generalFundRef
      ? {
          ref: generalFundRef,
          balance: isSameFund ? targetFundBalance : ((generalSnap?.data()?.balance as number) ?? 0),
        }
      : null;

    const result = postDonationToLedger({
      db,
      tx,
      donationId: donationRef.id,
      source,
      grossAmount: amount,
      commissionPercentage: orgSettings.commissionPercentage,
      targetFundRef: fundRef,
      targetFundBalance,
      generalFund,
      createdBy: uid,
    });

    tx.set(donationRef, {
      fundId,
      personId: personRef?.id ?? null,
      donorNameRaw: donorNameRaw ?? null,
      grossAmount: result.grossAmount,
      netAmount: result.netAmount,
      feeAmount: result.feeAmount,
      currency: 'ILS',
      transactionDate,
      source,
      rawMessage: rawMessage ?? null,
      status: 'confirmed',
      dedupeKey: buildDedupeKey({ transactionDate, amount, rawMessage, source }),
      confirmedBy: uid,
      confirmedAt: now,
      createdAt: now,
    });

    if (personRef) {
      creditDonation(
        tx,
        personRef,
        !isNewPerson,
        (personSnap?.data()?.totalDonated as number) ?? 0,
        amount,
        { fullName: donorNameRaw ?? '' }
      );
    }

    return result;
  });

  await writeAuditLog(db, {
    adminId: uid,
    action: 'donation.createManual',
    entity: 'donation',
    entityId: donationRef.id,
    fundId,
    details: { source, grossAmount: posted.grossAmount, feeAmount: posted.feeAmount },
  });

  return {
    donationId: donationRef.id,
    grossAmount: posted.grossAmount,
    netAmount: posted.netAmount,
    feeAmount: posted.feeAmount,
    balanceAfter: posted.targetBalanceAfter,
  };
});
