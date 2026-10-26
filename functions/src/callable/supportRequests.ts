import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from '../admin';
import { writeLedgerEntry } from '../ledger/ledgerService';

import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { PEOPLE, creditSupport } from '../people/peopleService';

// Approving, paying and recording repayments are all super-admin-only; a
// fundManager may watch these requests but never act on them (spec §4.6).
const assertAdmin = (role: unknown) => assertSuperAdmin(role);

async function recordStatusChange(
  requestRef: FirebaseFirestore.DocumentReference,
  status: string,
  uid: string,
  note?: string
) {
  await requestRef.collection('statusHistory').add({
    status,
    changedBy: uid,
    changedAt: Date.now(),
    note: note ?? null,
  });
}

// Approving is a decision only - it does NOT move money. The funds leave the
// fund when the admin later marks the request as actually paid (disburse),
// because payouts happen manually outside the app.
export const reviewSupportRequest = onCall<{
  requestId: string;
  decision: 'approved' | 'rejected';
  approvedAmount?: number;
  personId?: string;
  note?: string;
}>(async (request) => {
  assertAdmin(request.auth?.token.role);

  const { requestId, decision, approvedAmount, personId, note } = request.data ?? {};
  if (!requestId || (decision !== 'approved' && decision !== 'rejected')) {
    throw new HttpsError('invalid-argument', 'נדרש מזהה בקשה והחלטה תקינה');
  }

  const db = getFirestore();
  const requestRef = db.collection('supportRequests').doc(requestId);
  const snap = await requestRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'הבקשה לא נמצאה');
  }
  if (snap.data()?.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'הבקשה כבר טופלה');
  }

  const uid = request.auth!.uid;
  const finalAmount =
    decision === 'approved' ? (approvedAmount ?? (snap.data()?.requestedAmount as number)) : null;

  if (decision === 'approved' && (!finalAmount || finalAmount <= 0)) {
    throw new HttpsError('invalid-argument', 'סכום האישור חייב להיות חיובי');
  }

  await requestRef.update({
    status: decision,
    approvedAmount: finalAmount,
    // Links the payout to a People record so their totalReceived is credited
    // at disbursement time. Optional - can also be set at payout.
    ...(personId ? { personId } : {}),
    reviewedBy: uid,
    reviewedAt: Date.now(),
  });
  await recordStatusChange(requestRef, decision, uid, note);
  await writeAuditLog(db, {
    adminId: uid,
    action: `supportRequest.${decision}`,
    entity: 'supportRequest',
    entityId: requestId,
    fundId: snap.data()?.fundId ?? null,
    details: { approvedAmount: finalAmount, personId: personId ?? null },
  });

  return { ok: true };
});

// Marks an approved request as actually paid out and debits the fund.
export const disburseSupportRequest = onCall<{
  requestId: string;
  personId?: string;
  note?: string;
}>(async (request) => {
    assertAdmin(request.auth?.token.role);

    const { requestId, personId, note } = request.data ?? {};
    if (!requestId) {
      throw new HttpsError('invalid-argument', 'נדרש מזהה בקשה');
    }

    const db = getFirestore();
    const requestRef = db.collection('supportRequests').doc(requestId);
    const uid = request.auth!.uid;

    const balanceAfter = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'הבקשה לא נמצאה');
      }
      const req = reqSnap.data()!;
      if (req.status !== 'approved') {
        throw new HttpsError('failed-precondition', 'ניתן לשלם רק בקשה שאושרה');
      }

      const amount = req.approvedAmount as number;
      const fundRef = db.collection('funds').doc(req.fundId as string);
      const fundSnap = await tx.get(fundRef);
      if (!fundSnap.exists) {
        throw new HttpsError('not-found', 'הקרן לא נמצאה');
      }

      // A person linked now takes precedence over one set at approval, so an
      // admin can still attribute the payout at the last moment.
      const finalPersonId = personId ?? (req.personId as string | undefined);
      const personRef = finalPersonId
        ? db.collection(PEOPLE).doc(finalPersonId)
        : null;
      const personSnap = personRef ? await tx.get(personRef) : null;
      if (personRef && !personSnap?.exists) {
        throw new HttpsError('not-found', 'הנתמך שנבחר לא נמצא');
      }

      const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
      const isLoan = req.type === 'loan';

      const newBalance = writeLedgerEntry({
        db,
        tx,
        fundRef,
        currentBalance,
        type: isLoan ? 'loanOut' : 'supportOut',
        amount: -amount,
        relatedRequestId: requestId,
        createdBy: uid,
        note,
      });

      tx.update(requestRef, {
        status: isLoan ? 'inRepayment' : 'paid',
        paidAt: Date.now(),
        ...(finalPersonId ? { personId: finalPersonId } : {}),
      });

      if (personRef && personSnap?.exists) {
        creditSupport(tx, personRef, (personSnap.data()?.totalReceived as number) ?? 0, amount);
      }

      return newBalance;
    });

    await recordStatusChange(requestRef, 'paid', uid, note);
    await writeAuditLog(db, {
      adminId: uid,
      action: 'supportRequest.disburse',
      entity: 'supportRequest',
      entityId: requestId,
      details: { balanceAfter },
    });
    return { balanceAfter };
  }
);

// Records a loan repayment coming back into the fund.
export const recordLoanRepayment = onCall<{ requestId: string; amount: number; note?: string }>(
  async (request) => {
    assertAdmin(request.auth?.token.role);

    const { requestId, amount, note } = request.data ?? {};
    if (!requestId || !amount || amount <= 0) {
      throw new HttpsError('invalid-argument', 'נדרש מזהה בקשה וסכום חיובי');
    }

    const db = getFirestore();
    const requestRef = db.collection('supportRequests').doc(requestId);
    const uid = request.auth!.uid;

    const balanceAfter = await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(requestRef);
      if (!reqSnap.exists) {
        throw new HttpsError('not-found', 'הבקשה לא נמצאה');
      }
      const req = reqSnap.data()!;
      if (req.type !== 'loan' || req.status !== 'inRepayment') {
        throw new HttpsError('failed-precondition', 'ניתן לרשום החזר רק להלוואה פעילה');
      }

      const fundRef = db.collection('funds').doc(req.fundId as string);
      const fundSnap = await tx.get(fundRef);
      if (!fundSnap.exists) {
        throw new HttpsError('not-found', 'הקרן לא נמצאה');
      }

      const currentBalance = (fundSnap.data()?.balance as number) ?? 0;
      const alreadyRepaid = (req.repaidAmount as number) ?? 0;
      const totalRepaid = alreadyRepaid + amount;
      const approvedAmount = req.approvedAmount as number;

      const newBalance = writeLedgerEntry({
        db,
        tx,
        fundRef,
        currentBalance,
        type: 'loanRepayment',
        amount,
        relatedRequestId: requestId,
        createdBy: uid,
        note,
      });

      tx.update(requestRef, {
        repaidAmount: totalRepaid,
        status: totalRepaid >= approvedAmount ? 'closed' : 'inRepayment',
      });

      return newBalance;
    });

    return { balanceAfter };
  }
);
