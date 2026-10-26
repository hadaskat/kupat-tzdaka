// One-time migration for the hashed-username scheme.
//
// The Firebase Auth address used to be `<username>@kupat-tzedaka.internal`,
// which cannot hold a Hebrew username (email local parts must be ASCII). It is
// now `u<sha256(username)[0..32]>@kupat-tzedaka.internal`. Existing accounts
// must be moved across or their logins stop resolving.
//
//   set FIRESTORE_EMULATOR_HOST=localhost:8080
//   set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
//   node scripts/migrateUsernameEmails.js
//
// Idempotent - accounts already on the new address are skipped.

const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (usingEmulator) {
  admin.initializeApp({ projectId: 'demo-kupat-tzedaka' });
} else {
  const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

function syntheticEmail(username) {
  const normalized = String(username).normalize('NFKC').trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32);
  return `u${hash}@kupat-tzedaka.internal`;
}

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('users').get();
  let migrated = 0;
  let skipped = 0;

  for (const d of snap.docs) {
    const username = d.data().username;
    if (!username) continue;

    const expected = syntheticEmail(username);
    const record = await admin.auth().getUser(d.id).catch(() => null);
    if (!record) continue;

    if (record.email === expected) {
      skipped++;
      continue;
    }
    await admin.auth().updateUser(d.id, { email: expected });
    console.log(`  ${username}: ${record.email} -> ${expected}`);
    migrated++;
  }

  console.log(`\nusers migrated: ${migrated}, already current: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
