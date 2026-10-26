// One-time migration to the unified People card (spec §4.7):
//   donors + beneficiaries  -> people   (merged by normalized name)
//   donations.donorId       -> personId
//   supportRequests.beneficiaryId -> personId
//
// A person who appears in BOTH source collections becomes one record with
// isDonor and isBeneficiary set - that merge is the whole point of the change.
//
// Against the emulator:
//   set FIRESTORE_EMULATOR_HOST=localhost:8080
//   node scripts/migrateToPeople.js
//
// Safe to re-run: people are keyed by normalized name, and the id remaps are
// skipped once the new fields exist.

const path = require('path');
const admin = require('firebase-admin');

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (usingEmulator) {
  admin.initializeApp({ projectId: 'demo-kupat-tzedaka' });
} else {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function migrate() {
  const [donorsSnap, beneficiariesSnap] = await Promise.all([
    db.collection('donors').get(),
    db.collection('beneficiaries').get(),
  ]);

  // searchName -> { doc fields, donorIds[], beneficiaryIds[] }
  const merged = new Map();

  const upsert = (searchName, base) => {
    if (!merged.has(searchName)) {
      merged.set(searchName, {
        fullName: base.fullName,
        searchName,
        phone: null,
        email: null,
        idNumber: null,
        address: null,
        notes: null,
        linkedUserId: null,
        isDonor: false,
        isBeneficiary: false,
        totalDonated: 0,
        totalReceived: 0,
        createdAt: base.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        donorIds: [],
        beneficiaryIds: [],
      });
    }
    return merged.get(searchName);
  };

  for (const d of donorsSnap.docs) {
    const data = d.data();
    const key = normalize(data.fullName) || `donor-${d.id}`;
    const entry = upsert(key, data);
    entry.isDonor = true;
    entry.totalDonated += data.totalDonated ?? 0;
    entry.phone = entry.phone ?? data.phone ?? null;
    entry.email = entry.email ?? data.email ?? null;
    entry.idNumber = entry.idNumber ?? data.idNumber ?? null;
    entry.notes = entry.notes ?? data.notes ?? null;
    entry.linkedUserId = entry.linkedUserId ?? data.linkedUserId ?? null;
    entry.donorIds.push(d.id);
  }

  for (const b of beneficiariesSnap.docs) {
    const data = b.data();
    const key = normalize(data.fullName) || `ben-${b.id}`;
    const entry = upsert(key, data);
    entry.isBeneficiary = true;
    entry.totalReceived += data.totalReceived ?? 0;
    entry.phone = entry.phone ?? data.phone ?? null;
    entry.idNumber = entry.idNumber ?? data.idNumber ?? null;
    entry.address = entry.address ?? data.address ?? null;
    entry.notes = entry.notes ?? data.notes ?? null;
    entry.linkedUserId = entry.linkedUserId ?? data.linkedUserId ?? null;
    entry.beneficiaryIds.push(b.id);
  }

  // old donor/beneficiary id -> new person id
  const donorRemap = new Map();
  const beneficiaryRemap = new Map();
  let created = 0;
  let reused = 0;

  for (const [searchName, entry] of merged) {
    const existing = await db.collection('people').where('searchName', '==', searchName).limit(1).get();
    let personId;
    if (existing.empty) {
      const { donorIds, beneficiaryIds, ...fields } = entry;
      const ref = await db.collection('people').add(fields);
      personId = ref.id;
      created++;
    } else {
      personId = existing.docs[0].id;
      reused++;
    }
    entry.donorIds.forEach((id) => donorRemap.set(id, personId));
    entry.beneficiaryIds.forEach((id) => beneficiaryRemap.set(id, personId));
  }

  const bothRoles = [...merged.values()].filter((e) => e.isDonor && e.isBeneficiary).length;
  console.log(`people: ${created} created, ${reused} already existed`);
  console.log(`  of which donor AND beneficiary (merged): ${bothRoles}`);

  let donationsUpdated = 0;
  const donationsSnap = await db.collection('donations').get();
  for (const d of donationsSnap.docs) {
    const data = d.data();
    if (data.personId !== undefined) continue;
    const personId = data.donorId ? (donorRemap.get(data.donorId) ?? null) : null;
    await d.ref.update({ personId, donorId: admin.firestore.FieldValue.delete() });
    donationsUpdated++;
  }
  console.log(`donations remapped: ${donationsUpdated}`);

  let requestsUpdated = 0;
  const requestsSnap = await db.collection('supportRequests').get();
  for (const r of requestsSnap.docs) {
    const data = r.data();
    if (data.personId !== undefined) continue;
    const personId = data.beneficiaryId ? (beneficiaryRemap.get(data.beneficiaryId) ?? null) : null;
    await r.ref.update({ personId, beneficiaryId: admin.firestore.FieldValue.delete() });
    requestsUpdated++;
  }
  console.log(`support requests remapped: ${requestsUpdated}`);

  console.log(
    '\nMigration complete. The old donors/beneficiaries collections were left in place;' +
      '\ndelete them manually once you have verified the new כרטסת screen.'
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
