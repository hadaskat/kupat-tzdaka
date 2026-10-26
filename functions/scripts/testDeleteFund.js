// Verifies the three fund-deletion paths and the money-safety guard.
//   node scripts/testDeleteFund.js

const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const PROJECT_ID = 'demo-kupat-tzedaka';
const BASE = `http://localhost:5001/${PROJECT_ID}/us-central1`;
const API_KEY = 'demo-api-key';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function idTokenFor(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
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

async function call(name, data, idToken) {
  const res = await fetch(`${BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  return { ok: res.ok, body: await res.json() };
}

function check(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  console.log(`  ok  ${label}`);
}

async function makeFund(name) {
  const now = Date.now();
  return db.collection('funds').add({
    name,
    description: '',
    isGeneralFund: false,
    keywords: [],
    balance: 0,
    currency: 'ILS',
    active: true,
    createdBy: 'test',
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  const adminUser = (await db.collection('users').where('role', '==', 'superAdmin').limit(1).get())
    .docs[0];
  const idToken = await idTokenFor(adminUser.id);

  console.log('\n1) An unused fund is deleted outright');
  const unused = await makeFund('קרן בדיקה - לא בשימוש');
  const r1 = await call('deleteFund', { fundId: unused.id }, idToken);
  check('call succeeded', r1.ok);
  check('reported as deleted, not archived', r1.body.result.archived === false);
  check('document is gone', !(await unused.get()).exists);

  console.log('\n2) A fund holding money refuses to vanish');
  const withMoney = await makeFund('קרן בדיקה - עם יתרה');
  await call(
    'addManualDonation',
    { fundId: withMoney.id, amount: 700, transactionDate: Date.now() },
    idToken
  );
  check('balance is 700', (await withMoney.get()).data().balance === 700);

  const refused = await call('deleteFund', { fundId: withMoney.id }, idToken);
  check('deletion refused without a target', !refused.ok);
  check('fund still exists', (await withMoney.get()).exists);
  check('money untouched', (await withMoney.get()).data().balance === 700);

  console.log('\n3) Transferring the balance then closing');
  const target = await makeFund('קרן בדיקה - יעד');
  const before = (await target.get()).data().balance;
  const r3 = await call(
    'deleteFund',
    { fundId: withMoney.id, transferToFundId: target.id },
    idToken
  );
  check('call succeeded', r3.ok);
  check('reported as archived (it had history)', r3.body.result.archived === true);

  const closed = await withMoney.get();
  check('source still exists as a record', closed.exists);
  check('source balance is zero', closed.data().balance === 0);
  check('source marked closed', !!closed.data().closedAt && closed.data().active === false);
  const targetAfter = (await target.get()).data().balance;
  check(`target received the 700 (${before} -> ${targetAfter})`, targetAfter === before + 700);

  const srcLedger = await withMoney.collection('ledger').get();
  const hasTransferOut = srcLedger.docs.some((d) => d.data().amount === -700);
  check('transfer is recorded in the source ledger', hasTransferOut);

  console.log('\n4) The general fund is protected');
  const general = (await db.collection('funds').where('isGeneralFund', '==', true).limit(1).get())
    .docs[0];
  if (general) {
    const r4 = await call('deleteFund', { fundId: general.id }, idToken);
    check('deleting the only general fund is refused', !r4.ok);
  } else {
    console.log('  skip  (no general fund configured)');
  }

  // Leave the emulator tidy.
  await target.delete();
  await withMoney.delete();

  console.log('\nPASS: fund deletion protects the books.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
