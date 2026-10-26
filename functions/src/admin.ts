import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) {
  initializeApp();
}

export { getFirestore } from 'firebase-admin/firestore';
export { getAuth } from 'firebase-admin/auth';
export { getStorage } from 'firebase-admin/storage';
