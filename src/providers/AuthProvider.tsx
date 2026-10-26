import { useEffect, type PropsWithChildren } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import type { AppUser } from '../types/models';

export function AuthProvider({ children }: PropsWithChildren) {
  const setFirebaseUid = useAuthStore((s) => s.setFirebaseUid);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      setFirebaseUid(user?.uid ?? null);

      if (!user) {
        setProfile(null);
        setInitializing(false);
        return;
      }

      unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        setProfile(snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null);
        setInitializing(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, [setFirebaseUid, setProfile, setInitializing]);

  return <>{children}</>;
}
