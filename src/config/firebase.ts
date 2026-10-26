import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  connectAuthEmulator,
  getAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

// Placeholder values are only valid when useEmulator is true - a "demo-"
// projectId runs the Firebase Emulator Suite fully offline with no real
// credentials. Set the EXPO_PUBLIC_FIREBASE_* vars (see .env.example) and
// EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false to point at a real project.
// "||" (not "??") on purpose: unset EXPO_PUBLIC_FIREBASE_* vars come through
// as empty strings (declared-but-blank in .env), which "??" would not catch.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-kupat-tzedaka.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'demo-kupat-tzedaka',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-kupat-tzedaka.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth persistence differs by platform: the browser build persists to
// IndexedDB/localStorage on its own, while React Native needs AsyncStorage
// wired up explicitly or the session is lost on every app restart.
function initAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }

  // getReactNativePersistence only exists in @firebase/auth's "react-native"
  // export condition, which its shared public .d.ts does not declare - hence
  // the require + cast. Metro resolves that condition on native builds.
  const { getReactNativePersistence } = require('@firebase/auth') as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  };

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if auth was already initialized for this app,
    // which happens when Fast Refresh re-evaluates this module.
    return getAuth(firebaseApp);
  }
}

const auth = initAuth();

export { auth };
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);

if (useEmulator) {
  // Metro's dev server host doubles as the emulator host - works for
  // Expo Go on a physical device on the same network, not just localhost.
  const host =
    Constants.expoConfig?.hostUri?.split(':')[0] ??
    (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || 'localhost');

  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
}
