import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFunds } from '../../../src/api/funds';
import { formatCurrency } from '../../../src/utils/format';
import { Screen, Row } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

export default function FundsList() {
  const { funds, loading } = useFunds();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const active = funds.filter((f) => f.active);
  const closed = funds.filter((f) => !f.active);
  const total = active.reduce((sum, f) => sum + f.balance, 0);

  const renderFund = (fund: (typeof funds)[number], isLast: boolean) => (
    <View key={fund.id}>
      <Pressable onPress={() => router.push(`/funds/${fund.id}`)}>
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.pressed]}>
            <View style={styles.rowMain}>
              <Text style={styles.name}>{fund.name}</Text>
              {(fund.isGeneralFund || !fund.active) && (
                <Text style={styles.tag}>
                  {[
                    fund.isGeneralFund ? 'קרן כללית' : null,
                    fund.closedAt ? 'סגורה' : !fund.active ? 'לא פעילה' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>
            <Text style={styles.amount}>{formatCurrency(fund.balance)}</Text>
          </View>
        )}
      </Pressable>
      {!isLast && <Divider style={styles.divider} />}
    </View>
  );

  return (
    <Screen
      title="קרנות"
      subtitle={`${active.length} קרנות פעילות`}
      action={
        <Button mode="contained" icon="plus" onPress={() => router.push('/funds/new')}>
          קרן חדשה
        </Button>
      }
    >
      <Row>
        <StatCard label="קרנות פעילות" value={active.length} tone="accent" />
        <StatCard label="יתרה כוללת" value={formatCurrency(total)} caption="סך כל הקרנות הפעילות" />
        <StatCard label="קרנות סגורות" value={closed.length} caption="נשמרות לצורך ביקורת" />
      </Row>

      <View style={styles.gap} />

      <Panel title="קרנות פעילות">
        {active.length === 0 ? (
          <Text style={styles.empty}>עדיין לא נוצרו קרנות</Text>
        ) : (
          active.map((f, i) => renderFund(f, i === active.length - 1))
        )}
      </Panel>

      {closed.length > 0 && (
        <>
          <View style={styles.gap} />
          <Panel title="קרנות סגורות">
            {closed.map((f, i) => renderFund(f, i === closed.length - 1))}
          </Panel>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  tag: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: palette.neutralFigure },
  pressed: { opacity: 0.6 },
  divider: { backgroundColor: palette.line },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' },
});
