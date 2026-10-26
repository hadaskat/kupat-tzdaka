const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

admin.initializeApp({
  projectId: 'demo-kupat-tzedaka',
  storageBucket: 'demo-kupat-tzedaka.appspot.com',
});

const ADMIN_UID = process.argv[2];
if (!ADMIN_UID) {
  console.error('Usage: node testImport.js <adminUid>');
  process.exit(1);
}

async function main() {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  const filePath = path.join(__dirname, 'sample_bank.csv');
  const destination = `imports/${ADMIN_UID}/${Date.now()}_sample_bank.csv`;

  await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType: 'text/csv',
      metadata: { sourceType: 'bankCsv', uploadedBy: ADMIN_UID },
    },
  });
  console.log('Uploaded to', destination);

  // Poll for the importedFiles doc created by the trigger.
  let fileDoc = null;
  for (let i = 0; i < 20; i++) {
    const snap = await db.collection('importedFiles').where('storagePath', '==', destination).get();
    if (!snap.empty) {
      fileDoc = snap.docs[0];
      if (fileDoc.data().status !== 'parsing') break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!fileDoc) {
    console.error('No importedFiles doc appeared - trigger did not fire.');
    process.exit(1);
  }

  console.log('importedFiles doc:', JSON.stringify(fileDoc.data(), null, 2));

  const donationsSnap = await db
    .collection('donations')
    .where('importedFileId', '==', fileDoc.id)
    .get();

  console.log(`\n${donationsSnap.size} donation(s) created:`);
  donationsSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(
      `- amount=${data.amount} fundId=${data.fundId} status=${data.status} donorId=${data.donorId} rawMessage="${data.rawMessage}" possibleDuplicate=${data.possibleDuplicate}`
    );
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
