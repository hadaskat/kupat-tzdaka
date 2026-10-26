// Removes the funds and records created by the development test scripts,
// leaving anything created from a real login untouched.
//
//   node scripts/cleanupTestData.js          (dry run - shows what would go)
//   node scripts/cleanupTestData.js --apply
//
// Test data is identified by fund.createdBy being a script marker rather than
// a real user id.

const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_ID = 'demo-kupat-tzedaka';
const BASE = `http://localhost:5001/${PROJECT_ID}/us-central1`;
const API_KEY = 'demo-api-key';
const SCRIPT_MARKERS = ['test', 'seed', 'system'];

const apply = process.argv.includes('--apply');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function idTokenForAdmin() {
  const adminUser = (await db.collection('users').where('role', '==', 'superAdmin').limit(1).get())
    .docs[0];
  if (!adminUser) throw new Error('no super admin found');
  const customToken = await admin.auth().createCustomToken(adminUser.id);
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  return (await res.json()).idToken;
}

async function purgeFund(fundId, idToken) {
  const res = await fetch(`${BASE}/deleteFund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { fundId, mode: 'purge' } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.result;
}

async function main() {
  const fundsSnap = await db.collection('funds').get();
  const testFunds = fundsSnap.docs.filter((d) => SCRIPT_MARKERS.includes(String(d.data().createdBy)));
  const keptFunds = fundsSnap.docs.filter((d) => !SCRIPT_MARKERS.includes(String(d.data().createdBy)));

  console.log('WILL DELETE (created by test scripts):');
  testFunds.forEach((d) => console.log(`  - ${d.data().name}  (balance ${d.data().balance})`));
  console.log('\nWILL KEEP (created from a real login):');
  keptFunds.forEach((d) => console.log(`  - ${d.data().name}  (balance ${d.data().balance})`));

  // Donations whose fund no longer exists - left behind by earlier scripts.
  const fundIds = new Set(fundsSnap.docs.map((d) => d.id));
  const orphanDonations = (await db.collection('donations').get()).docs.filter(
    (d) => !fundIds.has(d.data().fundId)
  );
  const orphanRequests = (await db.collection('supportRequests').get()).docs.filter(
    (r) => !fundIds.has(r.data().fundId)
  );
  console.log(`\nOrphaned records to remove: ${orphanDonations.length} donations, ${orphanRequests.length} requests`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to perform the deletion.');
    process.exit(0);
  }

  const idToken = await idTokenForAdmin();

  for (const doc of testFunds) {
    // The general-fund guard would block the purge, so release the flag first.
    if (doc.data().isGeneralFund === true) {
      await doc.ref.update({ isGeneralFund: false });
      console.log(`\n(cleared the "general fund" flag on ${doc.data().name})`);
    }
    const result = await purgeFund(doc.id, idToken);
    console.log(
      `purged ${doc.data().name}: ${result.deleted.donations} donations, ` +
        `${result.deleted.supportRequests} requests, ${result.deleted.ledgerEntries} ledger entries`
    );
  }

  for (const d of orphanDonations) await d.ref.delete();
  for (const r of orphanRequests) await r.ref.delete();
  console.log(`removed ${orphanDonations.length} orphaned donations, ${orphanRequests.length} orphaned requests`);

  // People left with no activity at all are test residue.
  const people = await db.collection('people').get();
  let removedPeople = 0;
  for (const p of people.docs) {
    const [dons, reqs] = await Promise.all([
      db.collection('donations').where('personId', '==', p.id).count().get(),
      db.collection('supportRequests').where('personId', '==', p.id).count().get(),
    ]);
    if (dons.data().count === 0 && reqs.data().count === 0) {
      console.log(`  removing unused person: ${p.data().fullName}`);
      await p.ref.delete();
      removedPeople++;
    }
  }
  console.log(`removed ${removedPeople} people with no remaining activity`);

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
