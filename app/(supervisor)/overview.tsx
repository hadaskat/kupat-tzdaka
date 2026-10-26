import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useAuth } from '../../src/hooks/useAuth';
import {
  useSupervisedFunds,
  useSupervisedDonations,
  useSupervisedRequests,
} from '../../src/api/supervision';
import { formatCurrency, requestStatusLabel } from '../../src/utils/format';
import { Screen, Row, Col } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { Tag } from '../../src/components/layout/Tag';
import { palette, spacing } from '../../src/theme';

export default function SupervisorDashboard() {
  const { supervisedFundIds } = useAuth();
  const { funds, loading } = useSupervisedFunds(supervisedFundIds);
  const { donations } = useSupervisedDonations(supervisedFundIds);
  const { requests } = useSupervisedRequests(supervisedFundIds);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (funds.length === 0) {
    return (
      <Screen title="מסך פיקוח">
        <Panel title="לא שויכו לך קרנות">
          <Text style={styles.hint}>
            יש לפנות למנהל־על כדי לשייך אותך לקרנות שאתה אמור לפקח עליהן.
          </Text>
        </Panel>
      </Screen>
    );
  }

  const fundName = (fundId: string) => funds.find((f) => f.id === fundId)?.name ?? '—';
  const paidRequests = requests.filter((r) => r.status === 'paid' || r.status === 'inRepayment');
  const totalBalance = funds.reduce((s, f) => s + f.balance, 0);
  const totalPaid = paidRequests.reduce((s, r) => s + (r.approvedAmount ?? r.requestedAmount), 0);

  return (
    <Screen
      title="מסך פיקוח"
      subtitle='לצפייה בלבד. כל פעולת אישור או שינוי מתבצעת ע"י מנהל־על.'
    >
      <Row>
        <StatCard label="קרנות בפיקוחי" value={funds.length} tone="accent" />
        <StatCard label="יתרה כוללת" value={formatCurrency(totalBalance)} />
        <StatCard label="תרומות שנקלטו" value={donations.length} tone="in" />
        <StatCard label="תמיכות שחולקו" value={formatCurrency(totalPaid)} tone="out" />
      </Row>

      <View style={styles.gap} />

      <Panel title="יתרות הקרנות שלי">
        {funds.map((fund, i) => (
          <View key={fund.id}>
            {i > 0 && <Divider style={styles.divider} />}
            <View style={styles.lineRow}>
              <View style={styles.lineMain}>
                <Text style={styles.name}>{fund.name}</Text>
                {fund.isGeneralFund && (
                  <View style={styles.tagRow}>
                    <Tag label="קרן כללית" tone="accent" />
                  </View>
                )}
              </View>
              <Text style={styles.balance}>{formatCurrency(fund.balance)}</Text>
            </View>
          </View>
        ))}
      </Panel>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title="תרומות אחרונות שנקלטו">
            {donations.length === 0 ? (
              <Text style={styles.empty}>אין עדיין תרומות</Text>
            ) : (
              donations.slice(0, 15).map((d, i) => (
                <View key={d.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.lineRow}>
                    <View style={styles.lineMain}>
                      <Text style={styles.name}>{fundName(d.fundId)}</Text>
                      <Text style={styles.meta}>
                        {new Date(d.transactionDate).toLocaleDateString('he-IL')}
                        {d.donorNameRaw ? ` · ${d.donorNameRaw}` : ''}
                      </Text>
                    </View>
                    <View style={styles.amountBlock}>
                      <Text style={styles.amountIn}>
                        {formatCurrency(d.netAmount ?? d.grossAmount)}
                      </Text>
                      {d.feeAmount > 0 && (
                        <Text style={styles.meta}>מתוך {formatCurrency(d.grossAmount)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </Panel>
        </Col>

        <Col flex={1}>
          <Panel title="תמיכות שחולקו מהקרנות שלי">
            {paidRequests.length === 0 ? (
              <Text style={styles.empty}>לא חולקו עדיין תמיכות</Text>
            ) : (
              paidRequests.slice(0, 15).map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.lineRow}>
                    <View style={styles.lineMain}>
                      <Text style={styles.name}>{r.clientName || '—'}</Text>
                      <View style={styles.tagRow}>
                        <Text style={styles.meta}>{fundName(r.fundId)}</Text>
                        <Tag label={requestStatusLabel(r.status)} tone="in" />
                      </View>
                    </View>
                    <Text style={styles.amountOut}>
                      {formatCurrency(r.approvedAmount ?? r.requestedAmount)}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
  hint: { fontSize: 13, color: palette.inkMuted, lineHeight: 20 },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  lineMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  meta: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  balance: { fontSize: 16, fontWeight: '700', color: palette.ink },
  amountBlock: { alignItems: 'flex-end' },
  amountIn: { fontSize: 14, fontWeight: '700', color: palette.moneyIn },
  amountOut: { fontSize: 14, fontWeight: '700', color: palette.moneyOut },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' },
});
