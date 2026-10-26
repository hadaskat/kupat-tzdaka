import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { logout } from '../api/auth';
import { Panel } from './layout/StatCard';
import { palette, spacing } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  superAdmin: 'מנהל־על',
  fundManager: 'מנהל קרן (פיקוח)',
  client: 'לקוח',
};

/**
 * Identity line plus a compact logout, shared by all three settings screens.
 * Logout sits inline at the side rather than as a full-width button so it
 * doesn't read as the screen's primary action.
 */
export function SettingsHeader() {
  const { profile } = useAuth();

  return (
    <Panel>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{(profile?.fullName ?? '?').trim().charAt(0)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{profile?.fullName}</Text>
          <Text style={styles.subtitle}>
            @{profile?.username} · {ROLE_LABELS[profile?.role ?? ''] ?? ''}
          </Text>
        </View>
        <Button mode="text" compact icon="logout" onPress={() => logout()}>
          התנתקות
        </Button>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 18, fontWeight: '700', color: palette.accentDark },
  identity: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: palette.ink },
  subtitle: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
});
