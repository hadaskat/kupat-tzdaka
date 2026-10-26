import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from '../admin';
import { assertSuperAdmin } from '../auth/assertRole';
import { writeAuditLog } from '../audit/auditLog';
import { fetchAllSince } from '../nedarim/client';
import { mapTransaction, type MappedDonation } from '../nedarim/mapper';
import { readSyncState, writeSyncState } from '../nedarim/syncState';
import { resolveApiPassword } from '../nedarim/credentials';
import { matchFundByName, type MatchableFund } from '../matching/fundMatcher';
import { PEOPLE, buildPersonDoc, buildSearchName } from '../people/peopleService';
import { readOrgSettings } from '../org/orgSettings';
import { normalizeHebrewText } from '../utils/textNormalize';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Nedarim Plus API password. Stored as a Firebase secret so it never appears
 * in source control or in the deployed function's environment listing.
 * Set with:  firebase functions:secrets:set NEDARIM_API_PASSWORD
 */
const NEDARIM_API_PASSWORD = defineSecret('NEDARIM_API_PASSWORD');

interface PersonLookup {
  byIdNumber: Map<string, string>;
  byPhone: Map<string, string>;
  byName: Map<string, string>;
}

async function buildPersonLookup(db: Firestore): Promise<PersonLookup> {
  const snap = await db.collection(PEOPLE).get();
  const lookup: PersonLookup = {
    byIdNumber: new Map(),
    byPhone: new Map(),
    byName: new Map(),
  };
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.idNumber) lookup.byIdNumber.set(String(data.idNumber).trim(), doc.id);
    if (data.phone) lookup.byPhone.set(String(data.phone).replace(/\D/g, ''), doc.id);
    const searchName = (data.searchName as string) ?? normalizeHebrewText(String(data.fullName ?? ''));
    if (searchName) lookup.byName.set(searchName, doc.id);
  }
  return lookup;
}

/** ID number is the strongest signal, then phone, then an exact name match. */
function findPerson(donation: MappedDonation, lookup: PersonLookup): string | null {
  if (donation.donorIdNumber) {
    const byId = lookup.byIdNumber.get(donation.donorIdNumber.trim());
    if (byId) return byId;
  }
  if (donation.donorPhone) {
    const byPhone = lookup.byPhone.get(donation.donorPhone.replace(/\D/g, ''));
    if (byPhone) return byPhone;
  }
  const searchName = normalizeHebrewText(donation.donorName);
  return searchName ? (lookup.byName.get(searchName) ?? null) : null;
}

export const syncNedarimPlus = onCall(
  { secrets: [NEDARIM_API_PASSWORD] },
  async (request) => {
    assertSuperAdmin(request.auth?.token.role, 'רק מנהל־על יכול לסנכרן מנדרים פלוס');

    const db = getFirestore();
    const uid = request.auth!.uid;

    const orgSettings = await readOrgSettings(db);
    const mosadId = orgSettings.nedarimMosadId;
    if (!mosadId) {
      throw new HttpsError(
        'failed-precondition',
        'לא הוגדר מספר מוסד בנדרים פלוס. יש להזין אותו במסך הגדרות ארגון.'
      );
    }

    // Managed secret in production; env var when running on the emulator.
    const apiPassword = resolveApiPassword(NEDARIM_API_PASSWORD.value());

    const state = await readSyncState(db);

    let fetched: MappedDonation[] = [];
    let newCursor = state.lastTransactionId;
    try {
      const result = await fetchAllSince(
        { mosadId, apiPassword },
        state.lastTransactionId ?? undefined
      );
      fetched = result.transactions
        .map(mapTransaction)
        .filter((d): d is MappedDonation => d !== null);
      newCursor = result.lastId ?? state.lastTransactionId;
    } catch (error) {
      const message = (error as Error).message;
      await writeSyncState(db, { lastError: message, lastSyncAt: Date.now(), lastSyncBy: uid });
      throw new HttpsError('unavailable', message);
    }

    // Everything below is local bookkeeping - no more network calls.
    const [fundsSnap, existingSnap, lookup] = await Promise.all([
      db.collection('funds').where('active', '==', true).get(),
      db.collection('donations').where('source', '==', 'nedarimPlus').select('externalId').get(),
      buildPersonLookup(db),
    ]);

    const funds: MatchableFund[] = fundsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name as string,
    }));
    const generalFund = fundsSnap.docs.find((d) => d.data().isGeneralFund === true);
    const seen = new Set(
      existingSnap.docs.map((d) => String(d.data().externalId ?? '')).filter(Boolean)
    );

    let created = 0;
    let duplicates = 0;
    let unmatchedFund = 0;
    let usd = 0;
    let missingDate = 0;
    const skipped: string[] = [];

    let batch = db.batch();
    let batchSize = 0;
    const flush = async () => {
      if (batchSize === 0) return;
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    };

    for (const donation of fetched) {
      if (seen.has(donation.externalId)) {
        duplicates++;
        continue;
      }
      seen.add(donation.externalId);

      const match = matchFundByName(donation.groupe, funds);
      if (!match) unmatchedFund++;
      const fundId = match?.fundId ?? generalFund?.id;
      if (!fundId) {
        // Nowhere to file it; recording it against no fund would corrupt reports.
        skipped.push(donation.externalId);
        continue;
      }

      if (donation.currency === 'USD') usd++;
      if (donation.transactionDate === 0) missingDate++;

      // Reuse the donor's card when we recognise them, otherwise open one.
      let personId = findPerson(donation, lookup);
      if (!personId && donation.donorName) {
        const personRef = db.collection(PEOPLE).doc();
        batch.set(
          personRef,
          buildPersonDoc({
            fullName: donation.donorName,
            phone: donation.donorPhone,
            email: donation.donorEmail,
            idNumber: donation.donorIdNumber,
            address: donation.donorAddress,
            isDonor: true,
          })
        );
        batchSize++;
        personId = personRef.id;
        lookup.byName.set(buildSearchName(donation.donorName), personId);
        if (donation.donorIdNumber) lookup.byIdNumber.set(donation.donorIdNumber, personId);
        if (donation.donorPhone)
          lookup.byPhone.set(donation.donorPhone.replace(/\D/g, ''), personId);
      }

      const donationRef = db.collection('donations').doc();
      batch.set(donationRef, {
        fundId,
        personId: personId ?? null,
        donorNameRaw: donation.donorName || null,
        // The split is computed when the admin confirms, exactly as with imports.
        grossAmount: donation.amount,
        netAmount: donation.amount,
        feeAmount: 0,
        currency: donation.currency,
        transactionDate: donation.transactionDate,
        source: 'nedarimPlus',
        rawMessage: donation.comments || null,
        // USD never enters the shekel books automatically - it is held for
        // separate handling. Unmatched categories wait for manual assignment.
        status: donation.currency === 'USD' ? 'pendingMatch' : match ? 'matched' : 'pendingMatch',
        matchConfidence: match?.confidence ?? 0,
        externalId: donation.externalId,
        dedupeKey: `nedarim:${donation.externalId}`,
        isRecurring: donation.isRecurring,
        standingOrderId: donation.standingOrderId,
        externalReceiptId: donation.receiptId,
        confirmation: donation.confirmation,
        needsDateReview: donation.transactionDate === 0,
        createdAt: Date.now(),
      });
      batchSize++;
      created++;

      if (batchSize >= 400) await flush();
    }
    await flush();

    const summary = {
      fetched: fetched.length,
      created,
      duplicates,
      skipped: skipped.length,
      unmatchedFund,
      usd,
      missingDate,
    };

    await writeSyncState(db, {
      lastTransactionId: newCursor,
      lastSyncAt: Date.now(),
      lastSyncBy: uid,
      lastResult: summary,
      lastError: null,
    });

    await writeAuditLog(db, {
      adminId: uid,
      action: 'nedarim.sync',
      entity: 'integration',
      entityId: 'nedarimPlus',
      details: summary,
    });

    return summary;
  }
);
