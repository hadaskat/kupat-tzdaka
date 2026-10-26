// End-to-end check of the operating-commission split (spec §5).
// Requires the emulator suite to be running.
//   node scripts/testCommission.js

const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_ID = 'demo-kupat-tzedaka';
const FUNCTIONS_BASE = `http://localhost:5001/${PROJECT_ID}/us-central1`;
const API_KEY = 'demo-api-key';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function adminIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error('no idToken: ' + JSON.stringify(body));
  return body.idToken;
}

async function callFn(name, data, idToken) {
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body.result;
}

function assertEq(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`  ok  ${label} = ${actual}`);
}

async function makeFund(name, isGeneralFund) {
  const now = Date.now();
  const ref = await db.collection('funds').add({
    name,
    description: '',
    category: isGeneralFund ? 'general' : 'donation',
    isGeneralFund,
    keywords: [],
    balance: 0,
    currency: 'ILS',
    active: true,
    createdBy: 'test',
    createdAt: now,
    updatedAt: now,
  });
  return ref;
}

async function balanceOf(ref) {
  return (await ref.get()).data().balance;
}

async function main() {
  const adminUser = (await db.collection('users').where('role', '==', 'superAdmin').limit(1).get())
    .docs[0];
  if (!adminUser) throw new Error('no superAdmin found - run createFirstAdmin.js first');
  const idToken = await adminIdToken(adminUser.id);

  // Ensure exactly one general fund for a deterministic test.
  const existingGeneral = await db.collection('funds').where('isGeneralFund', '==', true).get();
  for (const d of existingGeneral.docs) await d.ref.update({ isGeneralFund: false });

  const target = await makeFund('קרן שיעור א׳ (בדיקה)', false);
  const general = await makeFund('קרן כללית (בדיקה)', true);

  console.log('\n1) Nedarim Plus donation of 1000 - expect 950 / 50 split');
  const r1 = await callFn(
    'addManualDonation',
    {
      fundId: target.id,
      amount: 1000,
      transactionDate: Date.now(),
      source: 'nedarimPlus',
    },
    idToken
  );
  assertEq('grossAmount', r1.grossAmount, 1000);
  assertEq('netAmount', r1.netAmount, 950);
  assertEq('feeAmount', r1.feeAmount, 50);
  assertEq('target fund balance', await balanceOf(target), 950);
  assertEq('general fund balance', await balanceOf(general), 50);

  console.log('\n2) Bank/manual donation of 1000 - expect NO commission');
  const r2 = await callFn(
    'addManualDonation',
    {
      fundId: target.id,
      amount: 1000,
      transactionDate: Date.now(),
      source: 'manualAdmin',
    },
    idToken
  );
  assertEq('feeAmount', r2.feeAmount, 0);
  assertEq('target fund balance', await balanceOf(target), 1950);
  assertEq('general fund balance (unchanged)', await balanceOf(general), 50);

  console.log('\n3) Commission percentage is configurable - switch to 10%');
  await callFn('updateOrgSettings', { commissionPercentage: 10 }, idToken);
  const r3 = await callFn(
    'addManualDonation',
    {
      fundId: target.id,
      amount: 500,
      transactionDate: Date.now(),
      source: 'nedarimPlus',
    },
    idToken
  );
  assertEq('feeAmount at 10%', r3.feeAmount, 50);
  assertEq('netAmount at 10%', r3.netAmount, 450);
  assertEq('general fund balance', await balanceOf(general), 100);

  console.log('\n4) Ledger records both slices, linked to the same donation');
  const targetLedger = await target.collection('ledger').get();
  const generalLedger = await general.collection('ledger').get();
  const commissionEntries = generalLedger.docs.filter((d) => d.data().type === 'commissionIn');
  assertEq('donationIn entries on target', targetLedger.size, 3);
  assertEq('commissionIn entries on general', commissionEntries.length, 2);
  const linked = commissionEntries.every((d) => !!d.data().relatedDonationId);
  assertEq('every commission entry links to its donation', linked, true);

  // Restore the default so the app is left in a sane state.
  await callFn('updateOrgSettings', { commissionPercentage: 5 }, idToken);

  console.log('\nPASS: commission engine behaves per spec §5.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
