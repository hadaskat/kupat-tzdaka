import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useFund, useFundDonations, useFundSupportRequests } from '../../../../src/api/funds';
import { usePeople } from '../../../../src/api/people';
import { formatCurrency } from '../../../../src/utils/format';
import { Screen, Row, Col } from '../../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../../src/theme';

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function FundTransactions() {
  const { fundId } = useLocalSearchParams<{ fundId: string }>();
  const { fund, loading } = useFund(fundId);
  const { donations, loading: donationsLoading } = useFundDonations(fundId);
  const { requests, loading: requestsLoading } = useFundSupportRequests(fundId);
  const { people } = usePeople();

  if (loading || donationsLoading || requestsLoading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!fund) {
    return (
      <View style={styles.center}>
        <Text>הקרן לא נמצאה</Text>
      </View>
    );
  }

  // Prefer the linked כרטסת name; fall back to whatever the payment record said.
  const personName = (personId?: string, fallback?: string) =>
    (personId ? people.find((p) => p.id === personId)?.fullName : undefined) ?? fallback ?? '—';

  const totalIn = donations.reduce((sum, d) => sum + d.netAmount, 0);
  const totalOut = requests.reduce((sum, r) => sum + (r.approvedAmount ?? 0), 0);

  return (
    <Screen back title={`תנועות · ${fund.name}`} subtitle="תרומות שנכנסו ותמיכות שחולקו">
      <Row>
        <StatCard label="נכנס" value={formatCurrency(totalIn)} tone="in" />
        <StatCard label="יצא" value={formatCurrency(totalOut)} tone="out" />
        <StatCard label="יתרה" value={formatCurrency(fund.balance)} tone="accent" />
      </Row>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title={`תרומות (${donations.length})`}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.nameCol]}>שם התורם</Text>
              <Text style={[styles.head, styles.amountCol]}>סכום</Text>
              <Text style={[styles.head, styles.dateCol]}>תאריך</Text>
            </View>
            <Divider style={styles.divider} />
            {donations.length === 0 ? (
              <Text style={styles.empty}>לא נכנסו עדיין תרומות לקרן זו</Text>
            ) : (
              donations.map((d, i) => (
                <View key={d.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.dataRow}>
                    <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
                      {personName(d.personId, d.donorNameRaw)}
                    </Text>
                    <Text style={[styles.cell, styles.amountCol, styles.in]}>
                      {formatCurrency(d.netAmount)}
                    </Text>
                    <Text style={[styles.cell, styles.dateCol, styles.muted]}>
                      {shortDate(d.transactionDate)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </Col>

        <Col flex={1}>
          <Panel title={`תמיכות (${requests.length})`}>
            <View style={styles.headRow}>
              <Text style={[styles.head, styles.nameCol]}>שם הנתמך</Text>
              <Text style={[styles.head, styles.amountCol]}>סכום</Text>
              <Text style={[styles.head, styles.dateCol]}>תאריך</Text>
            </View>
            <Divider style={styles.divider} />
            {requests.length === 0 ? (
              <Text style={styles.empty}>לא חולקו עדיין תמיכות מקרן זו</Text>
            ) : (
              requests.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.dataRow}>
                    <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
                      {personName(r.personId, r.clientName)}
                    </Text>
                    <Text style={[styles.cell, styles.amountCol, styles.out]}>
                      {formatCurrency(r.approvedAmount ?? r.requestedAmount)}
                    </Text>
                    <Text style={[styles.cell, styles.dateCol, styles.muted]}>
                      {shortDate(r.paidAt ?? r.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </Col>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
  headRow: { flexDirection: 'row', paddingBottom: spacing.sm },
  head: { fontSize: 12, fontWeight: '600', color: palette.inkMuted },
  dataRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2 },
  cell: { fontSize: 13, color: palette.ink },
  nameCol: { flex: 2 },
  amountCol: { flex: 1, fontWeight: '600' },
  dateCol: { width: 72 },
  in: { color: palette.moneyIn },
  out: { color: palette.moneyOut },
  muted: { color: palette.inkFaint, fontSize: 12 },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' },
});
