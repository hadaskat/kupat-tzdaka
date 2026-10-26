import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { changePassword, changeUsername } from '../api/auth';
import { isValidUsername } from '../utils/username';
import { Screen } from './layout/Screen';
import { Panel } from './layout/StatCard';
import { palette, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  superAdmin: 'מנהל־על',
  fundManager: 'מנהל קרן (פיקוח)',
  client: 'לקוח',
};

function describeError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'הסיסמה הנוכחית שגויה';
  }
  if (code === 'auth/weak-password') return 'הסיסמה החדשה חלשה מדי';
  if (code === 'auth/too-many-requests') return 'יותר מדי ניסיונות, נסו שוב מאוחר יותר';
  return (error as { message?: string })?.message ?? 'הפעולה נכשלה';
}

/**
 * Shared account screen - every role gets the same ability to rename itself
 * and change its own password.
 */
export function AccountSettings() {
  const { profile } = useAuth();

  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameDone, setUsernameDone] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  const onChangeUsername = async () => {
    setUsernameError(null);
    setUsernameDone(false);
    if (!isValidUsername(newUsername)) {
      setUsernameError('שם המשתמש יכול להכיל אותיות, ספרות, נקודה, מקף וקו תחתון (2-30 תווים)');
      return;
    }
    if (!usernamePassword) {
      setUsernameError('נא להזין את הסיסמה הנוכחית לאישור');
      return;
    }
    setUsernameBusy(true);
    try {
      await changeUsername(newUsername, usernamePassword);
      setUsernameDone(true);
      setNewUsername('');
      setUsernamePassword('');
    } catch (err) {
      setUsernameError(describeError(err));
    } finally {
      setUsernameBusy(false);
    }
  };

  const onChangePassword = async () => {
    setPasswordError(null);
    setPasswordDone(false);
    if (newPassword.length < 6) {
      setPasswordError('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('הסיסמאות אינן תואמות');
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(describeError(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <Screen
      narrow
      title={profile?.fullName ?? 'החשבון שלי'}
      subtitle={`@${profile?.username ?? ''} · ${ROLE_LABELS[profile?.role ?? ''] ?? ''}`}
    >
      <Panel title="שינוי שם משתמש">
        <TextInput
          mode="outlined"
          label="שם משתמש חדש"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="הסיסמה הנוכחית"
          value={usernamePassword}
          onChangeText={setUsernamePassword}
          secureTextEntry
          style={styles.input}
        />
        <HelperText type="error" visible={!!usernameError}>
          {usernameError}
        </HelperText>
        {usernameDone && (
          <HelperText type="info" visible>
            שם המשתמש עודכן.
          </HelperText>
        )}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={onChangeUsername}
            loading={usernameBusy}
            disabled={usernameBusy}
          >
            עדכון שם משתמש
          </Button>
        </View>
      </Panel>

      <View style={styles.gap} />

      <Panel title="שינוי סיסמה">
        <TextInput
          mode="outlined"
          label="הסיסמה הנוכחית"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="סיסמה חדשה"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="אימות סיסמה חדשה"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={styles.input}
        />
        <HelperText type="error" visible={!!passwordError}>
          {passwordError}
        </HelperText>
        {passwordDone && (
          <HelperText type="info" visible>
            הסיסמה עודכנה.
          </HelperText>
        )}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={onChangePassword}
            loading={passwordBusy}
            disabled={passwordBusy}
          >
            עדכון סיסמה
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
