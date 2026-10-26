// One-time migration for data created before the three-role model (spec §3):
//   role 'admin'          -> 'superAdmin'   (+ empty fundIds)
//   fund.category general -> isGeneralFund  (+ backfills the flag on all funds)
//   donation.amount       -> grossAmount / netAmount / feeAmount
//   seeds orgSettings/main with the default 5% commission
//
// Against the emulator:
//   set FIRESTORE_EMULATOR_HOST=localhost:8080
//   set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
//   node scripts/migrateToThreeRoles.js
//
// Against production: place serviceAccountKey.json in functions/ and run without
// the emulator env vars. Safe to re-run - every step is idempotent.

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

async function migrateUsers() {
  const snap = await db.collection('users').get();
  let changed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    const updates = {};
    if (data.role === 'admin') updates.role = 'superAdmin';
    if (data.fundIds === undefined) updates.fundIds = [];
    if (Object.keys(updates).length === 0) continue;

    updates.updatedAt = Date.now();
    await d.ref.update(updates);
    if (updates.role) {
      await admin.auth().setCustomUserClaims(d.id, { role: updates.role });
    }
    changed++;
  }
  console.log(`users migrated: ${changed}`);
}

async function migrateFunds() {
  const snap = await db.collection('funds').get();
  let changed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.isGeneralFund !== undefined) continue;
    await d.ref.update({
      isGeneralFund: data.category === 'general',
      updatedAt: Date.now(),
    });
    changed++;
  }
  console.log(`funds migrated: ${changed}`);
}

async function migrateDonations() {
  const snap = await db.collection('donations').get();
  let changed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.grossAmount !== undefined) continue;
    const gross = data.amount ?? 0;
    // Everything that predates the commission engine was recorded at 100%.
    await d.ref.update({ grossAmount: gross, netAmount: gross, feeAmount: 0 });
    changed++;
  }
  console.log(`donations migrated: ${changed}`);
}

async function seedOrgSettings() {
  const ref = db.doc('orgSettings/main');
  if ((await ref.get()).exists) {
    console.log('orgSettings: already present, left untouched');
    return;
  }
  await ref.set({
    orgName: '',
    orgNumber: '',
    section46CertNumber: '',
    section46ValidUntil: null,
    commissionPercentage: 5,
    updatedAt: Date.now(),
  });
  console.log('orgSettings: seeded with 5% commission');
}

async function main() {
  await migrateUsers();
  await migrateFunds();
  await migrateDonations();
  await seedOrgSettings();
  console.log('\nMigration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
