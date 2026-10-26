// Creates Hebrew-named demo accounts for manual testing:
//   מנהל  - super admin (full control)
//   מפקח  - fund manager, scoped to every existing fund (view only)
//
//   set FIRESTORE_EMULATOR_HOST=localhost:8080
//   set FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
//   node scripts/createDemoUsers.js
//
// Re-running resets both accounts' passwords rather than failing.

const crypto = require('crypto');
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'demo-kupat-tzedaka' });

const PASSWORD = 'Aa123456';

function syntheticEmail(username) {
  const normalized = String(username).normalize('NFKC').trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32);
  return `u${hash}@kupat-tzedaka.internal`;
}

async function upsertUser({ username, fullName, role, fundIds }) {
  const db = admin.firestore();
  const email = syntheticEmail(username);

  let record = await admin.auth().getUserByEmail(email).catch(() => null);
  if (record) {
    await admin.auth().updateUser(record.uid, { password: PASSWORD, displayName: fullName });
  } else {
    record = await admin.auth().createUser({ email, password: PASSWORD, displayName: fullName });
  }

  await admin.auth().setCustomUserClaims(record.uid, { role });

  const now = Date.now();
  await db.collection('users').doc(record.uid).set(
    {
      role,
      username: username.normalize('NFKC').trim().toLowerCase(),
      fullName,
      phone: null,
      fundIds: fundIds ?? [],
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  await db.collection('usernames').doc(username.normalize('NFKC').trim().toLowerCase()).set({
    uid: record.uid,
    createdAt: now,
  });

  return record.uid;
}

async function main() {
  const db = admin.firestore();
  const funds = await db.collection('funds').get();
  const allFundIds = funds.docs.map((d) => d.id);

  const adminUid = await upsertUser({
    username: 'מנהל',
    fullName: 'מנהל ראשי',
    role: 'superAdmin',
  });

  // Scoped to every fund so there is something to look at; narrow it from the
  // "ניהול הרשאות" screen to see the scoping take effect.
  const managerUid = await upsertUser({
    username: 'מפקח',
    fullName: 'מפקח קרנות',
    role: 'fundManager',
    fundIds: allFundIds,
  });

  console.log('Demo users ready (password for both: ' + PASSWORD + ')\n');
  console.log(`  מנהל   super admin    uid=${adminUid}`);
  console.log(`  מפקח   fund manager   uid=${managerUid}  funds=${allFundIds.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
