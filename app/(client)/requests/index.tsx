import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useMySupportRequests } from '../../../src/api/supportRequests';
import { useAuth } from '../../../src/hooks/useAuth';
import { formatCurrency, requestStatusLabel, requestTypeLabel } from '../../../src/utils/format';
import type { SupportRequest } from '../../../src/types/models';
import { Screen } from '../../../src/components/layout/Screen';
import { Panel } from '../../../src/components/layout/StatCard';
import { Tag, type TagTone } from '../../../src/components/layout/Tag';
import { palette, spacing } from '../../../src/theme';

const STATUS_TONE: Record<SupportRequest['status'], TagTone> = {
  pending: 'warn',
  approved: 'accent',
  rejected: 'out',
  paid: 'in',
  inRepayment: 'accent',
  closed: 'neutral',
};

export default function MyRequestsList() {
  const { firebaseUid } = useAuth();
  const { requests, loading } = useMySupportRequests(firebaseUid);
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Screen
      title="הבקשות שלי"
      subtitle="מעקב אחר בקשות התמיכה שהגשתם"
      action={
        <Button mode="contained" icon="plus" onPress={() => router.push('/requests/new')}>
          בקשה חדשה
        </Button>
      }
    >
      <Panel>
        {requests.length === 0 ? (
          <Text style={styles.empty}>עדיין לא הגשתם בקשות</Text>
        ) : (
          requests.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider style={styles.divider} />}
              <Pressable onPress={() => router.push(`/requests/${item.id}`)}>
                {({ pressed }) => (
                  <View style={[styles.row, pressed && styles.pressed]}>
                    <View style={styles.rowMain}>
                      <Text style={styles.name}>{requestTypeLabel(item.type)}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta}>
                          {new Date(item.createdAt).toLocaleDateString('he-IL')}
                        </Text>
                        <Tag
                          label={requestStatusLabel(item.status)}
                          tone={STATUS_TONE[item.status]}
                        />
                      </View>
                    </View>
                    <Text style={styles.amount}>
                      {formatCurrency(item.approvedAmount ?? item.requestedAmount)}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  divider: { backgroundColor: palette.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  meta: { fontSize: 12, color: palette.inkFaint },
  amount: { fontSize: 15, fontWeight: '700', color: palette.ink },
  pressed: { opacity: 0.6 },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
