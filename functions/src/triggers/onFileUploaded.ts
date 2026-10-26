import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore, getStorage } from '../admin';
import { getAdapterForSourceType } from '../parsers';
import { matchFundInFreeText, type MatchableFund } from '../matching/fundMatcher';
import { matchPerson, type MatchablePerson } from '../matching/personMatcher';
import { buildDedupeKey } from '../utils/dedupe';
import type { ImportSourceType, DonationSource } from '../types';

/** Unmatched rows land in the general fund, so one is created if missing. */
async function getOrCreateGeneralFundId(db: FirebaseFirestore.Firestore): Promise<string> {
  const existing = await db.collection('funds').where('isGeneralFund', '==', true).limit(1).get();
  if (!existing.empty) return existing.docs[0].id;

  const ref = db.collection('funds').doc();
  const now = Date.now();
  await ref.set({
    name: 'כללי',
    description: 'קרן ברירת מחדל לתרומות שלא ניתן לשייך אוטומטית לקרן ייעודית',
    isGeneralFund: true,

    balance: 0,
    currency: 'ILS',
    active: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

function sourceTypeToDonationSource(sourceType: ImportSourceType): DonationSource {
  if (sourceType === 'creditCardCsv') return 'creditCardImport';
  return 'bankImport';
}

export const onFileUploaded = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  if (!filePath.startsWith('imports/')) return;

  const metadata = event.data.metadata ?? {};
  const sourceType = metadata.sourceType as ImportSourceType | undefined;
  const uploadedBy = metadata.uploadedBy as string | undefined;
  const fileName = filePath.split('/').pop() ?? filePath;

  if (!sourceType || !uploadedBy) {
    console.error('Missing sourceType/uploadedBy metadata on upload', filePath);
    return;
  }

  const db = getFirestore();
  const fileRef = db.collection('importedFiles').doc();
  await fileRef.set({
    fileName,
    storagePath: filePath,
    sourceType,
    uploadedBy,
    uploadedAt: Date.now(),
    status: 'parsing',
    rowCount: 0,
    matchedCount: 0,
    unmatchedCount: 0,
  });

  try {
    const bucket = getStorage().bucket(event.data.bucket);
    const [buffer] = await bucket.file(filePath).download();

    const adapter = getAdapterForSourceType(sourceType);
    const rows = adapter.parse(buffer);

    const [fundsSnap, peopleSnap, existingDonationsSnap] = await Promise.all([
      db.collection('funds').where('active', '==', true).get(),
      db.collection('people').get(),
      db.collection('donations').select('dedupeKey').get(),
    ]);

    const funds: MatchableFund[] = fundsSnap.docs.map((d) => ({
      id: d.id,
      name: d.data().name as string,
    }));
    const people: MatchablePerson[] = peopleSnap.docs.map((d) => ({
      id: d.id,
      fullName: d.data().fullName as string,
    }));
    const existingDedupeKeys = new Set(existingDonationsSnap.docs.map((d) => d.data().dedupeKey));

    const generalFundId = await getOrCreateGeneralFundId(db);
    const donationSource = sourceTypeToDonationSource(sourceType);

    let matchedCount = 0;
    let unmatchedCount = 0;
    const now = Date.now();

    let batch = db.batch();
    let batchSize = 0;
    const flushBatch = async () => {
      if (batchSize === 0) return;
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    };

    for (const row of rows) {
      const fundMatch = matchFundInFreeText(row.rawMessage, funds);
      const personId = matchPerson(row.counterpartyName, people);
      const dedupeKey = buildDedupeKey({
        transactionDate: row.date,
        amount: row.amount,
        rawMessage: row.rawMessage,
        source: donationSource,
      });
      const possibleDuplicate = existingDedupeKeys.has(dedupeKey);

      if (fundMatch) matchedCount++;
      else unmatchedCount++;

      const donationRef = db.collection('donations').doc();
      batch.set(donationRef, {
        fundId: fundMatch?.fundId ?? generalFundId,
        personId: personId ?? null,
        donorNameRaw: row.counterpartyName ?? null,
        // Bank/credit-card donations carry no operating commission (spec §5),
        // so net equals gross. Confirmed values are recomputed on approval.
        grossAmount: row.amount,
        netAmount: row.amount,
        feeAmount: 0,
        currency: 'ILS',
        transactionDate: row.date,
        source: donationSource,
        rawMessage: row.rawMessage,
        status: fundMatch ? 'matched' : 'pendingMatch',
        matchConfidence: fundMatch?.confidence ?? 0,
        possibleDuplicate,
        dedupeKey,
        importedFileId: fileRef.id,
        createdAt: now,
      });
      batchSize++;

      if (batchSize >= 400) await flushBatch();
    }
    await flushBatch();

    await fileRef.update({
      status: 'parsed',
      rowCount: rows.length,
      matchedCount,
      unmatchedCount,
    });
  } catch (error) {
    await fileRef.update({
      status: 'failed',
      errorLog: error instanceof Error ? error.message : String(error),
    });
  }
});
