import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useMyPledges } from '../../src/api/donations';
import { useFunds } from '../../src/api/funds';
import { useAuth } from '../../src/hooks/useAuth';
import { formatCurrency, donorDonationStatusLabel } from '../../src/utils/format';
import { Screen, Row } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { Tag } from '../../src/components/layout/Tag';
import { palette, spacing } from '../../src/theme';

export default function MyDonations() {
  const { firebaseUid } = useAuth();
  const { donations, loading } = useMyPledges(firebaseUid);
  const { funds } = useFunds();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const total = donations.reduce((s, d) => s + d.grossAmount, 0);

  return (
    <Screen title="התרומות שלי" subtitle="כל התרומות שנרשמו על שמכם">
      <Row>
        <StatCard label="סה״כ תרומות" value={formatCurrency(total)} tone="in" />
        <StatCard label="מספר תרומות" value={donations.length} tone="accent" />
      </Row>

      <View style={styles.gap} />

      <Panel>
        {donations.length === 0 ? (
          <Text style={styles.empty}>עדיין לא רשמתם תרומות</Text>
        ) : (
          donations.map((item, i) => {
            const fundName = funds.find((f) => f.id === item.fundId)?.name ?? '—';
            return (
              <View key={item.id}>
                {i > 0 && <Divider style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.name}>{fundName}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>
                        {new Date(item.transactionDate).toLocaleDateString('he-IL')}
                      </Text>
                      <Tag label={donorDonationStatusLabel(item.status)} />
                    </View>
                    {!!item.rawMessage && <Text style={styles.message}>{item.rawMessage}</Text>}
                  </View>
                  <Text style={styles.amount}>{formatCurrency(item.grossAmount)}</Text>
                </View>
              </View>
            );
          })
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
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
  message: { fontSize: 12, color: palette.inkMuted, marginTop: 4 },
  amount: { fontSize: 15, fontWeight: '700', color: palette.moneyIn },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
