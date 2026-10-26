import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import type { OrgSettings, AppUser } from '../types/models';

const DEFAULT_SETTINGS: OrgSettings = {
  orgName: '',
  orgNumber: '',
  section46CertNumber: '',
  commissionPercentage: 5,
  nedarimMosadId: '',
  updatedAt: 0,
};

export function useOrgSettings() {
  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'orgSettings', 'main'),
      (snap) => {
        setSettings(
          snap.exists() ? { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<OrgSettings>) } : DEFAULT_SETTINGS
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { settings, loading };
}

export function updateOrgSettings(changes: Partial<OrgSettings>) {
  return httpsCallable(functions, 'updateOrgSettings')(changes);
}

export function useAllUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'users'), orderBy('fullName')),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as AppUser));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { users, loading };
}

export function setUserRole(uid: string, role: AppUser['role'], fundIds: string[] = []) {
  return httpsCallable(functions, 'setUserRole')({ uid, role, fundIds });
}

export function setFundPermissions(uid: string, fundIds: string[]) {
  return httpsCallable(functions, 'setFundPermissions')({ uid, fundIds });
}

interface CreateUserParams {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  role: AppUser['role'];
  fundIds?: string[];
}

export function createUserByAdmin(params: CreateUserParams) {
  return httpsCallable<CreateUserParams, { uid: string }>(functions, 'createUserByAdmin')(params);
}

export function deleteUserByAdmin(uid: string) {
  return httpsCallable<{ uid: string }, { ok: boolean }>(functions, 'deleteUserByAdmin')({ uid });
}

/** Fund-centric: replaces the whole supervisor list for one fund. */
export function setFundSupervisors(fundId: string, uids: string[]) {
  return httpsCallable<{ fundId: string; uids: string[] }, { ok: boolean; promoted: string[] }>(
    functions,
    'setFundSupervisors'
  )({ fundId, uids });
}
