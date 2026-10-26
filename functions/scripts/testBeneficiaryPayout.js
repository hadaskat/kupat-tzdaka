// End-to-end check that a support payout credits the linked beneficiary.
// Requires the emulator suite to be running.
//
//   node scripts/testBeneficiaryPayout.js <requestId> <beneficiaryId>

const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_ID = 'demo-kupat-tzedaka';
const FUNCTIONS_BASE = `http://localhost:5001/${PROJECT_ID}/us-central1`;
const API_KEY = 'demo-api-key';

admin.initializeApp({ projectId: PROJECT_ID });

const [, , requestId, beneficiaryId] = process.argv;
if (!requestId || !beneficiaryId) {
  console.error('Usage: node testBeneficiaryPayout.js <requestId> <beneficiaryId>');
  process.exit(1);
}

// Exchanges a custom token for an ID token so callables see a real admin auth context.
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  return body.result;
}

async function main() {
  const db = admin.firestore();

  const adminUser = (await db.collection('users').where('role', '==', 'admin').limit(1).get())
    .docs[0];
  if (!adminUser) throw new Error('no admin user found - run createFirstAdmin.js first');
  const idToken = await adminIdToken(adminUser.id);

  const before = await db.collection('beneficiaries').doc(beneficiaryId).get();
  console.log('BEFORE totalReceived =', before.data().totalReceived);

  await callFn('reviewSupportRequest', { requestId, decision: 'approved', beneficiaryId }, idToken);
  const afterReview = await db.collection('supportRequests').doc(requestId).get();
  console.log(
    'AFTER approve  status =',
    afterReview.data().status,
    '| beneficiaryId =',
    afterReview.data().beneficiaryId,
    '| approvedAmount =',
    afterReview.data().approvedAmount
  );

  await callFn('disburseSupportRequest', { requestId }, idToken);
  const afterPay = await db.collection('supportRequests').doc(requestId).get();
  const after = await db.collection('beneficiaries').doc(beneficiaryId).get();
  console.log('AFTER payout   status =', afterPay.data().status);
  console.log('AFTER totalReceived =', after.data().totalReceived);

  const expected = before.data().totalReceived + afterReview.data().approvedAmount;
  if (after.data().totalReceived !== expected) {
    throw new Error(`totalReceived mismatch: expected ${expected}, got ${after.data().totalReceived}`);
  }
  console.log('\nPASS: beneficiary credited correctly.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
