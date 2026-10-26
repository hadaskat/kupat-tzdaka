export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'שם משתמש או סיסמה שגויים';
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות התחברות, נסו שוב מאוחר יותר';
    case 'functions/already-exists':
      return 'שם המשתמש כבר תפוס';
    case 'functions/invalid-argument':
      return (error as { message?: string })?.message ?? 'נתונים לא תקינים';
    default:
      return 'אירעה שגיאה, נסו שוב';
  }
}
