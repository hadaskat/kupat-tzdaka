import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const profile = useAuthStore((s) => s.profile);
  const initializing = useAuthStore((s) => s.initializing);
  const role = profile?.role ?? null;

  return {
    firebaseUid,
    profile,
    initializing,
    isAuthenticated: !!firebaseUid && !!profile,
    role,
    isSuperAdmin: role === 'superAdmin',
    isFundManager: role === 'fundManager',
    /** Funds a supervisor may view; empty for other roles. */
    supervisedFundIds: role === 'fundManager' ? (profile?.fundIds ?? []) : [],
  };
}

/** Landing route for a role - keeps redirects in one place. */
export function homeRouteForRole(role: string | null): string {
  if (role === 'superAdmin') return '/(admin)/dashboard';
  if (role === 'fundManager') return '/(supervisor)/overview';
  return '/(client)/home';
}
