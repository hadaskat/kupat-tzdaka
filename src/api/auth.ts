import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { usernameToSyntheticEmail } from '../utils/username';

export async function loginWithUsername(username: string, password: string) {
  const email = await usernameToSyntheticEmail(username);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

interface RegisterParams {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
}

export async function registerWithUsername({ username, password, fullName, phone }: RegisterParams) {
  const registerUser = httpsCallable<RegisterParams, { uid: string }>(functions, 'registerUser');
  await registerUser({ username, password, fullName, phone });
  return loginWithUsername(username, password);
}

export function logout() {
  return signOut(auth);
}

/**
 * Changing a password requires proving you know the current one. Firebase
 * enforces that via re-authentication rather than trusting a recent session.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('לא ניתן לשנות סיסמה ללא התחברות');
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/**
 * Renaming also moves the underlying Auth address, since it is derived from
 * the username - so it runs server-side with the Admin SDK.
 */
export async function changeUsername(newUsername: string, currentPassword: string) {
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('לא ניתן לשנות שם משתמש ללא התחברות');
  }
  // Re-authenticate first so a walked-away-from device can't be renamed.
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);

  const fn = httpsCallable<{ newUsername: string }, { ok: boolean }>(functions, 'changeUsername');
  await fn({ newUsername });

  // The Auth address changed underneath us; re-sign in so the local session
  // matches the new credentials.
  return loginWithUsername(newUsername, currentPassword);
}
