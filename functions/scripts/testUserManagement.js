// Verifies admin user creation/deletion end to end, including the guards.
//   node scripts/testUserManagement.js

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
  const body = await res.json();
  return { ok: res.ok, body };
}

function check(label, condition) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  console.log(`  ok  ${label}`);
}

async function main() {
  const adminUser = (await db.collection('users').where('role', '==', 'superAdmin').limit(1).get())
    .docs[0];
  const idToken = await idTokenFor(adminUser.id);

  console.log('\n1) Create a user with a Hebrew username');
  const created = await call(
    'createUserByAdmin',
    { username: 'רב-שמעון', password: 'Aa123456', fullName: 'הרב שמעון', role: 'fundManager' },
    idToken
  );
  check('creation succeeded', created.ok);
  const newUid = created.body.result.uid;

  const doc = await db.collection('users').doc(newUid).get();
  check('users doc written', doc.exists);
  check('role is fundManager', doc.data().role === 'fundManager');
  const claims = (await admin.auth().getUser(newUid)).customClaims;
  check('custom claim set', claims.role === 'fundManager');
  const nameDoc = await db.collection('usernames').doc('רב-שמעון').get();
  check('username reserved', nameDoc.exists && nameDoc.data().uid === newUid);

  console.log('\n2) The new user can actually sign in');
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update('רב-שמעון', 'utf8').digest('hex').slice(0, 32);
  const signIn = await fetch(
    `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `u${hash}@kupat-tzedaka.internal`,
        password: 'Aa123456',
        returnSecureToken: true,
      }),
    }
  );
  check('sign-in works', signIn.ok);

  console.log('\n3) Duplicate username is rejected');
  const dup = await call(
    'createUserByAdmin',
    { username: 'רב-שמעון', password: 'Aa123456', fullName: 'מישהו אחר', role: 'client' },
    idToken
  );
  check('duplicate refused', !dup.ok);

  console.log('\n4) Guards');
  const self = await call('deleteUserByAdmin', { uid: adminUser.id }, idToken);
  check('cannot delete yourself', !self.ok);

  console.log('\n5) Delete the user we created');
  const del = await call('deleteUserByAdmin', { uid: newUid }, idToken);
  check('deletion succeeded', del.ok);
  check('users doc gone', !(await db.collection('users').doc(newUid).get()).exists);
  check('username released', !(await db.collection('usernames').doc('רב-שמעון').get()).exists);
  const authGone = await admin.auth().getUser(newUid).catch(() => null);
  check('auth account gone', authGone === null);

  console.log('\n6) Last super admin is protected');
  const admins = await db.collection('users').where('role', '==', 'superAdmin').get();
  if (admins.size === 1) {
    const only = await call('deleteUserByAdmin', { uid: admins.docs[0].id }, idToken);
    check('last super admin protected', !only.ok);
  } else {
    console.log(`  skip  (${admins.size} super admins exist, guard needs exactly 1)`);
  }

  console.log('\nPASS: user management works.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n' + err.message);
  process.exit(1);
});
