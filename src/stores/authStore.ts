import { create } from 'zustand';
import type { AppUser } from '../types/models';

interface AuthState {
  firebaseUid: string | null;
  profile: AppUser | null;
  initializing: boolean;
  setFirebaseUid: (uid: string | null) => void;
  setProfile: (profile: AppUser | null) => void;
  setInitializing: (value: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUid: null,
  profile: null,
  initializing: true,
  setFirebaseUid: (uid) => set({ firebaseUid: uid }),
  setProfile: (profile) => set({ profile }),
  setInitializing: (value) => set({ initializing: value }),
  reset: () => set({ firebaseUid: null, profile: null, initializing: false }),
}));
