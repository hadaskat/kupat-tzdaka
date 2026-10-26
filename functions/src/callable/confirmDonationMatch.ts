import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { postDonationToLedger, findGeneralFund } from '../ledger/postDonation';
import { readOrgSettings } from '../org/orgSettings';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { PEOPLE, creditDonation } from '../people/peopleService';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
import type { DonationSource } from '../types';

interface ConfirmOverrides {
  fundId?: string;
  personId?: string;
}

interface ConfirmContext {
  commissionPercentage: number;
  generalFundRef: DocumentReference | null;
}

async function confirmSingleDonation(
  db: Firestore,
  donationId: string,
  uid: string,
  ctx: ConfirmContext,
  overrides: ConfirmOverrides = {}
): Promise<number> {
  const donationRef = db.collection('donations').doc(donationId);

  return db.runTransaction(async (tx: Transaction) => {
    const donationSnap = await tx.get(donationRef);
    if (!donationSnap.exists) {
      throw new HttpsError('not-found', 'התרומה לא נמצאה');
    }
    const donation = donationSnap.data()!;
    if (donation.status !== 'pendingMatch' && donation.status !== 'matched') {
      throw new HttpsError('failed-precondition', 'התרומה כבר טופלה');
    }
    // Fund balances are kept in shekels. Posting a dollar amount into them
    // would silently overstate the fund by the exchange rate.
    if (donation.currency && donation.currency !== 'ILS') {
      throw new HttpsError(
        'failed-precondition',
        `תרומה במטבע ${donation.currency} אינה נכנסת ליתרה השקלית. יש לטפל בה בנפרד.`
      );
    }

    const finalFundId = overrides.fundId ?? donation.fundId;
    const finalPersonId = overrides.personId ?? donation.personId ?? null;

    const fundRef = db.collection('funds').doc(finalFundId);
    const fundSnap = await tx.get(fundRef);
    if (!fundSnap.exists) {
      throw new HttpsError('not-found', 'הקרן שנבחרה לא נמצאה');
    }

    const personRef = finalPersonId ? db.collection(PEOPLE).doc(finalPersonId) : null;
    let personSnap = null;
    if (personRef) {
      personSnap = await tx.get(personRef);
      if (!personSnap.exists) {
        throw new HttpsError('not-found', 'התורם שנבחר לא נמצא');
      }
    }

    const isSameFund = ctx.generalFundRef?.id === fundRef.id;
    const generalSnap =
      ctx.generalFundRef && !isSameFund ? await tx.get(ctx.generalFundRef) : null;

    const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
    // Imported rows predate the gross/net split, so fall back to `amount`.
    const grossAmount = (donation.grossAmount ?? donation.amount) as number;
    const source = donation.source as DonationSource;
    const now = Date.now();

    const generalFund = ctx.generalFundRef
      ? {
          ref: ctx.generalFundRef,
          balance: isSameFund ? currentBalance : ((generalSnap?.data()?.balance as number) ?? 0),
        }
      : null;

    const posted = postDonationToLedger({
      db,
      tx,
      donationId,
      source,
      grossAmount,
      commissionPercentage: ctx.commissionPercentage,
      targetFundRef: fundRef,
      targetFundBalance: currentBalance,
      generalFund,
      createdBy: uid,
    });

    tx.update(donationRef, {
      status: 'confirmed',
      fundId: finalFundId,
      personId: finalPersonId,
      grossAmount: posted.grossAmount,
      netAmount: posted.netAmount,
      feeAmount: posted.feeAmount,
      confirmedBy: uid,
      confirmedAt: now,
    });

    if (personRef && personSnap) {
      creditDonation(
        tx,
        personRef,
        true,
        (personSnap.data()?.totalDonated as number) ?? 0,
        grossAmount
      );
    }

    return posted.targetBalanceAfter;
  });
}

async function loadConfirmContext(db: Firestore): Promise<ConfirmContext> {
  const [orgSettings, generalFundRef] = await Promise.all([
    readOrgSettings(db),
    findGeneralFund(db),
  ]);
  return { commissionPercentage: orgSettings.commissionPercentage, generalFundRef };
}

export const confirmDonationMatch = onCall<{ donationId: string } & ConfirmOverrides>(
  async (request) => {
    assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לאשר תרומה');
    const { donationId, fundId, personId } = request.data ?? {};
    if (!donationId) {
      throw new HttpsError('invalid-argument', 'נדרש מזהה תרומה');
    }

    const db = getFirestore();
    const uid = request.auth!.uid;
    const ctx = await loadConfirmContext(db);
    const balanceAfter = await confirmSingleDonation(db, donationId, uid, ctx, {
      fundId,
      personId,
    });

    await writeAuditLog(db, {
      adminId: uid,
      action: 'donation.confirm',
      entity: 'donation',
      entityId: donationId,
      fundId: fundId ?? null,
    });
    return { balanceAfter };
  }
);

export const bulkConfirmDonations = onCall<{ donationIds: string[] }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לאשר תרומות');
  const { donationIds } = request.data ?? {};
  if (!Array.isArray(donationIds) || donationIds.length === 0) {
    throw new HttpsError('invalid-argument', 'נדרשת רשימת תרומות לאישור');
  }

  const db = getFirestore();
  const uid = request.auth!.uid;
  const ctx = await loadConfirmContext(db);
  const confirmed: string[] = [];
  const failed: { donationId: string; error: string }[] = [];

  for (const donationId of donationIds) {
    try {
      await confirmSingleDonation(db, donationId, uid, ctx);
      confirmed.push(donationId);
    } catch (error) {
      failed.push({
        donationId,
        error: error instanceof HttpsError ? error.message : 'שגיאה לא צפויה',
      });
    }
  }

  await writeAuditLog(db, {
    adminId: uid,
    action: 'donation.bulkConfirm',
    entity: 'donation',
    entityId: `${confirmed.length} donations`,
    details: { confirmed: confirmed.length, failed: failed.length },
  });

  return { confirmed, failed };
});

export const rejectDonationMatch = onCall<{ donationId: string }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לדחות תרומה');
  const { donationId } = request.data ?? {};
  if (!donationId) {
    throw new HttpsError('invalid-argument', 'נדרש מזהה תרומה');
  }

  const db = getFirestore();
  const donationRef = db.collection('donations').doc(donationId);
  const snap = await donationRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'התרומה לא נמצאה');
  }
  if (snap.data()?.status === 'confirmed') {
    throw new HttpsError('failed-precondition', 'לא ניתן לדחות תרומה שכבר אושרה');
  }

  await donationRef.update({ status: 'rejected', confirmedBy: request.auth!.uid, confirmedAt: Date.now() });
  return { ok: true };
});
