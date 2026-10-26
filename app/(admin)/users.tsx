import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Button,
  TextInput,
  HelperText,
  SegmentedButtons,
  Searchbar,
  Portal,
  Modal,
  Dialog,
  IconButton,
  Divider,
} from 'react-native-paper';
import { useAllUsers, createUserByAdmin, deleteUserByAdmin } from '../../src/api/org';
import { useAuth } from '../../src/hooks/useAuth';
import { normalizeName } from '../../src/utils/normalizeName';
import type { AppUser, UserRole } from '../../src/types/models';
import { Screen, Row } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { Tag, type TagTone } from '../../src/components/layout/Tag';
import { palette, spacing } from '../../src/theme';

const ROLE_LABELS: Record<UserRole, string> = {
  superAdmin: 'מנהל־על',
  fundManager: 'מנהל קרן',
  client: 'לקוח',
};

const ROLE_TONE: Record<UserRole, TagTone> = {
  superAdmin: 'accent',
  fundManager: 'warn',
  client: 'neutral',
};

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'client', label: 'לקוח' },
  { value: 'fundManager', label: 'מנהל קרן' },
  { value: 'superAdmin', label: 'מנהל־על' },
];

export default function Users() {
  const { users, loading } = useAllUsers();
  const { firebaseUid } = useAuth();

  const [search, setSearch] = useState('');
  const [addVisible, setAddVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('client');

  const term = normalizeName(search);
  const filtered = users.filter(
    (u) =>
      !term ||
      normalizeName(u.fullName).includes(term) ||
      u.username.includes(search.trim())
  );

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setRole('client');
  };

  const onCreate = async () => {
    setError(null);
    if (fullName.trim().length < 2) return setError('נא להזין שם מלא');
    if (username.trim().length < 2) return setError('נא להזין שם משתמש');
    if (password.length < 6) return setError('הסיסמה חייבת להכיל לפחות 6 תווים');

    setBusy(true);
    try {
      await createUserByAdmin({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
      });
      setAddVisible(false);
      resetForm();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'יצירת המשתמש נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setError(null);
    try {
      await deleteUserByAdmin(pendingDelete.uid);
      setPendingDelete(null);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'המחיקה נכשלה');
      setPendingDelete(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  const count = (r: UserRole) => users.filter((u) => u.role === r).length;

  return (
    <>
      <Screen
        back
        title="ניהול משתמשים"
        subtitle='מי שיכול להתחבר לאפליקציה. תורמים ונתמכים ללא חשבון נמצאים במסך "כרטסת".'
        action={
          <Button
            mode="contained"
            icon="account-plus"
            onPress={() => {
              resetForm();
              setError(null);
              setAddVisible(true);
            }}
          >
            משתמש חדש
          </Button>
        }
      >
        <Row>
          <StatCard label="סה״כ משתמשים" value={users.length} tone="accent" />
          <StatCard label="מנהלי־על" value={count('superAdmin')} />
          <StatCard label="מנהלי קרנות" value={count('fundManager')} />
          <StatCard label="לקוחות" value={count('client')} />
        </Row>

        <View style={styles.gap} />

        <Panel>
          <Searchbar
            placeholder="חיפוש לפי שם או שם משתמש"
            value={search}
            onChangeText={setSearch}
            style={styles.search}
            elevation={0}
          />

          <HelperText type="error" visible={!!error && !addVisible}>
            {error}
          </HelperText>

          {filtered.length === 0 ? (
            <Text style={styles.empty}>לא נמצאו משתמשים</Text>
          ) : (
            filtered.map((u, i) => (
              <View key={u.uid}>
                {i > 0 && <Divider style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.identity}>
                    <Text style={styles.name}>{u.fullName}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>
                        @{u.username}
                        {u.uid === firebaseUid ? ' · אתה' : ''}
                      </Text>
                      <Tag label={ROLE_LABELS[u.role]} tone={ROLE_TONE[u.role]} />
                    </View>
                  </View>
                  {u.uid !== firebaseUid && (
                    <IconButton
                      icon="trash-can-outline"
                      iconColor={palette.moneyOut}
                      size={20}
                      onPress={() => setPendingDelete(u)}
                    />
                  )}
                </View>
              </View>
            ))
          )}
        </Panel>
      </Screen>

      <Portal>
        <Modal
          visible={addVisible}
          onDismiss={() => setAddVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>משתמש חדש</Text>
            <TextInput
              mode="outlined"
              label="שם מלא"
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="שם משתמש"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="סיסמה"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              mode="outlined"
              label="טלפון (אופציונלי)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <Text style={styles.label}>תפקיד</Text>
            <SegmentedButtons
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              buttons={roleOptions}
              style={styles.input}
            />
            {role === 'fundManager' && (
              <Text style={styles.hint}>
                את הקרנות שהוא יפקח עליהן משייכים במסך "ניהול הרשאות".
              </Text>
            )}
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
            <View style={styles.modalActions}>
              <Button mode="contained" onPress={onCreate} loading={busy} disabled={busy}>
                יצירת משתמש
              </Button>
              <Button mode="text" onPress={() => setAddVisible(false)} disabled={busy}>
                ביטול
              </Button>
            </View>
          </ScrollView>
        </Modal>

        <Dialog visible={!!pendingDelete} onDismiss={() => setPendingDelete(null)}>
          <Dialog.Title>מחיקת משתמש</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              למחוק את "{pendingDelete?.fullName}"? הוא לא יוכל יותר להתחבר.
            </Text>
            <Text style={styles.dialogHint}>
              תרומות, בקשות ותנועות כספיות שלו יישמרו — הן חלק מספרי הקופה.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingDelete(null)}>ביטול</Button>
            <Button textColor={palette.moneyOut} onPress={onDelete} loading={busy} disabled={busy}>
              מחיקה
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  gap: { height: spacing.md },
  search: { backgroundColor: palette.page, marginBottom: spacing.sm },
  divider: { backgroundColor: palette.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flex: 1, paddingVertical: spacing.sm },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  meta: { fontSize: 12, color: palette.inkFaint },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
  modal: {
    backgroundColor: palette.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    maxHeight: '85%',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  label: { fontSize: 13, color: palette.inkMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dialogHint: { fontSize: 12, color: palette.inkFaint, marginTop: spacing.sm, lineHeight: 18 },
});
