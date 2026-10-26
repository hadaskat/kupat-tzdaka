import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, SegmentedButtons, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAllSupportRequests } from '../../../src/api/supportRequests';
import { useFunds } from '../../../src/api/funds';
import { formatCurrency, requestStatusLabel, requestTypeLabel } from '../../../src/utils/format';
import type { SupportRequest } from '../../../src/types/models';
import { Screen, Row } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { Tag, type TagTone } from '../../../src/components/layout/Tag';
import { palette, spacing } from '../../../src/theme';

type Filter = 'pending' | 'active' | 'all';

const filterOptions: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'ממתינות' },
  { value: 'active', label: 'בטיפול' },
  { value: 'all', label: 'הכל' },
];

const STATUS_TONE: Record<SupportRequest['status'], TagTone> = {
  pending: 'warn',
  approved: 'accent',
  rejected: 'out',
  paid: 'in',
  inRepayment: 'accent',
  closed: 'neutral',
};

export default function RequestsList() {
  const { requests, loading } = useAllSupportRequests();
  const { funds } = useFunds();
  const [filter, setFilter] = useState<Filter>('pending');
  const router = useRouter();

  const filtered = requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending';
    return r.status === 'approved' || r.status === 'inRepayment';
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const pendingSum = requests
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.requestedAmount, 0);
  const paidSum = requests
    .filter((r) => r.status === 'paid')
    .reduce((s, r) => s + (r.approvedAmount ?? r.requestedAmount), 0);

  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? '—';

  return (
    <Screen title="בקשות תמיכה" subtitle="אישור, דחייה ותשלום בפועל">
      <Row>
        <StatCard label="ממתינות להחלטה" value={pendingCount} tone="accent" />
        <StatCard label="סכום מבוקש ממתין" value={formatCurrency(pendingSum)} />
        <StatCard label="שולם עד כה" value={formatCurrency(paidSum)} tone="out" />
        <StatCard label="סה״כ בקשות" value={requests.length} />
      </Row>

      <View style={styles.gap} />

      <Panel>
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          buttons={filterOptions}
          style={styles.filter}
        />

        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>אין בקשות להצגה</Text>
        ) : (
          filtered.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider style={styles.divider} />}
              <Pressable onPress={() => router.push(`/requests/${item.id}`)}>
                {({ pressed }) => (
                  <View style={[styles.row, pressed && styles.pressed]}>
                    <View style={styles.rowMain}>
                      <Text style={styles.name}>{item.clientName || '—'}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta}>
                          {new Date(item.createdAt).toLocaleDateString('he-IL')}
                        </Text>
                        <Text style={styles.meta}>{fundName(item.fundId)}</Text>
                        <Tag label={requestTypeLabel(item.type)} />
                        <Tag label={requestStatusLabel(item.status)} tone={STATUS_TONE[item.status]} />
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
  gap: { height: spacing.md },
  filter: { marginBottom: spacing.md },
  loader: { marginVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  meta: { fontSize: 12, color: palette.inkFaint },
  amount: { fontSize: 15, fontWeight: '700', color: palette.ink },
  pressed: { opacity: 0.6 },
  divider: { backgroundColor: palette.line },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
