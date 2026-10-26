// One-time bootstrap for the very first admin account (registration always
// creates 'client' users - there is no public admin sign-up).
//
// Against the local emulator:
//   set FIRESTORE_EMULATOR_HOST=localhost:8080
//   set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
//   node scripts/createFirstAdmin.js admin Str0ngPass! "שם המנהל"
//
// Against production: place a service account key at functions/serviceAccountKey.json
// (already gitignored) and run the same command without the emulator env vars.

const path = require('path');
const admin = require('firebase-admin');

const [, , username, password, fullName] = process.argv;
if (!username || !password || !fullName) {
  console.error('Usage: node createFirstAdmin.js <username> <password> "<fullName>"');
  process.exit(1);
}

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (!usingEmulator) {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp({ projectId: 'demo-kupat-tzedaka' });
}

const crypto = require('crypto');

// Mirrors functions/src/utils/username.ts - the Auth address is a hash of the
// username so Hebrew usernames still yield a valid ASCII email local part.
const normalizedUsername = username.normalize('NFKC').trim().toLowerCase();
const emailHash = crypto
  .createHash('sha256')
  .update(normalizedUsername, 'utf8')
  .digest('hex')
  .slice(0, 32);
const email = `u${emailHash}@kupat-tzedaka.internal`;

async function main() {
  const userRecord = await admin.auth().createUser({
    email,
    password,
    displayName: fullName,
  });

  await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'superAdmin' });

  const now = Date.now();
  await admin.firestore().collection('usernames').doc(normalizedUsername).set({
    uid: userRecord.uid,
    createdAt: now,
  });
  await admin.firestore().collection('users').doc(userRecord.uid).set({
    role: 'superAdmin',
    username: normalizedUsername,
    fullName,
    phone: null,
    fundIds: [],
    active: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Admin created: uid=${userRecord.uid} username=${normalizedUsername}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
