import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { writeLedgerEntry } from '../ledger/ledgerService';
import type { Firestore, Query } from 'firebase-admin/firestore';

type DeleteMode = 'archive' | 'purge';

interface DeleteFundRequest {
  fundId: string;
  mode?: DeleteMode;
  /** Required when archiving a fund that still holds money. */
  transferToFundId?: string;
}

const BATCH_LIMIT = 400;

/** Deletes every document a query matches, in batches. */
async function deleteQuery(db: Firestore, query: Query): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < BATCH_LIMIT) return deleted;
  }
}

/** Preview of what a purge would destroy, so the admin can be shown the cost. */
export const getFundDeletionImpact = onCall<{ fundId: string }>(async (request) => {
  assertSuperAdmin(request.auth?.token.role);
  const { fundId } = request.data ?? {};
  if (!fundId) throw new HttpsError('invalid-argument', 'נדרש מזהה קרן');

  const db = getFirestore();
  const fundSnap = await db.collection('funds').doc(fundId).get();
  if (!fundSnap.exists) throw new HttpsError('not-found', 'הקרן לא נמצאה');

  const [ledger, donations, requests] = await Promise.all([
    db.collection('funds').doc(fundId).collection('ledger').count().get(),
    db.collection('donations').where('fundId', '==', fundId).count().get(),
    db.collection('supportRequests').where('fundId', '==', fundId).count().get(),
  ]);

  return {
    balance: (fundSnap.data()?.balance as number) ?? 0,
    ledgerEntries: ledger.data().count,
    donations: donations.data().count,
    supportRequests: requests.data().count,
  };
});

/**
 * Removes a fund, either way the admin chose (spec §4.2).
 *
 * archive - the default and the safe one. Money must be moved out first, and
 *           the fund plus its history stay readable for audit.
 * purge   - genuinely erases the fund and everything attached to it. Used to
 *           clear mistakes and test data. Because donation and payout records
 *           feed the כרטסת totals, those totals are corrected on the way out;
 *           skipping that would leave people credited for money that no longer
 *           exists anywhere.
 */
export const deleteFund = onCall<DeleteFundRequest>(async (request) => {
  assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול למחוק קרן');

  const { fundId, mode = 'archive', transferToFundId } = request.data ?? {};
  if (!fundId) {
    throw new HttpsError('invalid-argument', 'נדרש מזהה קרן');
  }
  if (transferToFundId === fundId) {
    throw new HttpsError('invalid-argument', 'לא ניתן להעביר את היתרה לאותה קרן');
  }
  if (mode !== 'archive' && mode !== 'purge') {
    throw new HttpsError('invalid-argument', 'סוג מחיקה לא תקין');
  }

  const db = getFirestore();
  const uid = request.auth!.uid;
  const fundRef = db.collection('funds').doc(fundId);
  const fundSnap = await fundRef.get();
  if (!fundSnap.exists) {
    throw new HttpsError('not-found', 'הקרן לא נמצאה');
  }

  const fund = fundSnap.data()!;
  const balance = (fund.balance as number) ?? 0;

  // Removing the commission target would break every Nedarim Plus donation.
  if (fund.isGeneralFund === true) {
    const generals = await db.collection('funds').where('isGeneralFund', '==', true).get();
    if (generals.docs.filter((d) => d.id !== fundId).length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'זו הקרן הכללית. יש לסמן קרן אחרת כ"קרן כללית" לפני מחיקתה.'
      );
    }
  }

  // Either way the fund stops being supervised.
  const supervisors = await db.collection('users').where('fundIds', 'array-contains', fundId).get();
  if (!supervisors.empty) {
    const batch = db.batch();
    for (const doc of supervisors.docs) {
      const next = ((doc.data().fundIds as string[]) ?? []).filter((id) => id !== fundId);
      batch.update(doc.ref, { fundIds: next, updatedAt: Date.now() });
    }
    await batch.commit();
  }

  if (mode === 'purge') {
    // Roll back the כרטסת totals this fund contributed, so nobody is left
    // credited for donations that no longer exist.
    const adjustments = new Map<string, { donated: number; received: number }>();
    const bump = (personId: string, field: 'donated' | 'received', amount: number) => {
      const current = adjustments.get(personId) ?? { donated: 0, received: 0 };
      current[field] += amount;
      adjustments.set(personId, current);
    };

    const donationsSnap = await db.collection('donations').where('fundId', '==', fundId).get();
    for (const d of donationsSnap.docs) {
      const data = d.data();
      if (data.personId && data.status === 'confirmed') {
        bump(data.personId as string, 'donated', (data.grossAmount as number) ?? 0);
      }
    }

    const requestsSnap = await db.collection('supportRequests').where('fundId', '==', fundId).get();
    for (const r of requestsSnap.docs) {
      const data = r.data();
      const paid = data.status === 'paid' || data.status === 'inRepayment' || data.status === 'closed';
      if (data.personId && paid) {
        bump(data.personId as string, 'received', (data.approvedAmount as number) ?? 0);
      }
      // statusHistory is a subcollection and would otherwise be orphaned.
      await deleteQuery(db, r.ref.collection('statusHistory'));
    }

    for (const [personId, delta] of adjustments) {
      const personRef = db.collection('people').doc(personId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(personRef);
        if (!snap.exists) return;
        const data = snap.data()!;
        tx.update(personRef, {
          totalDonated: Math.max(0, ((data.totalDonated as number) ?? 0) - delta.donated),
          totalReceived: Math.max(0, ((data.totalReceived as number) ?? 0) - delta.received),
          updatedAt: Date.now(),
        });
      });
    }

    const [ledgerDeleted, donationsDeleted, requestsDeleted] = await Promise.all([
      deleteQuery(db, fundRef.collection('ledger')),
      deleteQuery(db, db.collection('donations').where('fundId', '==', fundId)),
      deleteQuery(db, db.collection('supportRequests').where('fundId', '==', fundId)),
    ]);

    await fundRef.delete();

    await writeAuditLog(db, {
      adminId: uid,
      action: 'fund.purge',
      entity: 'fund',
      entityId: fundId,
      details: {
        name: fund.name ?? null,
        erasedBalance: balance,
        ledgerEntries: ledgerDeleted,
        donations: donationsDeleted,
        supportRequests: requestsDeleted,
        peopleAdjusted: adjustments.size,
      },
    });

    return {
      purged: true,
      archived: false,
      deleted: {
        ledgerEntries: ledgerDeleted,
        donations: donationsDeleted,
        supportRequests: requestsDeleted,
      },
    };
  }

  // --- archive ---
  if (balance !== 0) {
    if (!transferToFundId) {
      throw new HttpsError(
        'failed-precondition',
        'לקרן יש יתרה. יש לבחור קרן אחרת שאליה תועבר היתרה לפני הסגירה.'
      );
    }

    const targetRef = db.collection('funds').doc(transferToFundId);
    await db.runTransaction(async (tx) => {
      const [sourceNow, targetNow] = await Promise.all([tx.get(fundRef), tx.get(targetRef)]);
      if (!targetNow.exists) {
        throw new HttpsError('not-found', 'קרן היעד לא נמצאה');
      }
      const sourceBalance = (sourceNow.data()?.balance as number) ?? 0;
      if (sourceBalance === 0) return;
      const targetBalance = (targetNow.data()?.balance as number) ?? 0;
      const targetName = (targetNow.data()?.name as string) ?? '';
      const sourceName = (sourceNow.data()?.name as string) ?? '';

      writeLedgerEntry({
        db,
        tx,
        fundRef,
        currentBalance: sourceBalance,
        type: 'adjustment',
        amount: -sourceBalance,
        createdBy: uid,
        note: `העברת יתרה לקרן "${targetName}" עם סגירת הקרן`,
        allowNegative: true,
      });
      writeLedgerEntry({
        db,
        tx,
        fundRef: targetRef,
        currentBalance: targetBalance,
        type: 'adjustment',
        amount: sourceBalance,
        createdBy: uid,
        note: `קליטת יתרה מקרן "${sourceName}" שנסגרה`,
        allowNegative: true,
      });
    });
  }

  // A fund that was never used leaves nothing worth keeping.
  const [ledgerSnap, donationsSnap, requestsSnap] = await Promise.all([
    fundRef.collection('ledger').limit(1).get(),
    db.collection('donations').where('fundId', '==', fundId).limit(1).get(),
    db.collection('supportRequests').where('fundId', '==', fundId).limit(1).get(),
  ]);
  const hasHistory = !ledgerSnap.empty || !donationsSnap.empty || !requestsSnap.empty;

  if (hasHistory) {
    await fundRef.update({
      active: false,
      isGeneralFund: false,
      closedAt: Date.now(),
      closedBy: uid,
      updatedAt: Date.now(),
    });
  } else {
    await fundRef.delete();
  }

  await writeAuditLog(db, {
    adminId: uid,
    action: hasHistory ? 'fund.close' : 'fund.delete',
    entity: 'fund',
    entityId: fundId,
    fundId,
    details: {
      name: fund.name ?? null,
      transferredBalance: balance,
      transferredTo: balance !== 0 ? (transferToFundId ?? null) : null,
    },
  });

  return { purged: false, archived: hasHistory };
});
