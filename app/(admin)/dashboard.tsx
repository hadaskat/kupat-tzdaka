import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFunds } from '../../src/api/funds';
import { usePendingDonations } from '../../src/api/imports';
import { useAllSupportRequests } from '../../src/api/supportRequests';
import { formatCurrency } from '../../src/utils/format';
import { Screen, Row, Col } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { palette, spacing } from '../../src/theme';

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function Dashboard() {
  const { funds, loading } = useFunds();
  const { donations: pending } = usePendingDonations();
  const { requests } = useAllSupportRequests();
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const activeFunds = funds.filter((f) => f.active);
  const totalBalance = activeFunds.reduce((sum, f) => sum + f.balance, 0);
  const pendingTotal = pending.reduce((sum, d) => sum + d.grossAmount, 0);
  const openRequests = requests.filter((r) => r.status === 'pending');
  const openRequestsTotal = openRequests.reduce((sum, r) => sum + r.requestedAmount, 0);

  const now = new Date();
  const subtitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <Screen title="מסך ראשי" subtitle={subtitle}>
      <Row>
        <StatCard label="קרנות פעילות" value={activeFunds.length} tone="accent" />
        <StatCard
          label="יתרה כוללת"
          value={formatCurrency(totalBalance)}
          caption="סך היתרות בכל הקרנות"
        />
        <StatCard
          label="ממתינות לאישור"
          value={formatCurrency(pendingTotal)}
          caption={`${pending.length} תרומות שטרם נכנסו ליתרה`}
          tone="in"
          onPress={() => router.push('/pending')}
        />
        <StatCard
          label="בקשות פתוחות"
          value={formatCurrency(openRequestsTotal)}
          caption={`${openRequests.length} בקשות תמיכה לטיפול`}
          tone="out"
          onPress={() => router.push('/requests')}
        />
      </Row>

      <View style={styles.gap} />

      <Row>
        {/* Actions first so they land on the right in RTL - the side the eye
            reaches first. */}
        <Col flex={1}>
          <Panel title="פעולות מהירות">
            <View style={styles.actions}>
              <Button mode="contained" onPress={() => router.push('/pending')}>
                אישור תרומות
              </Button>
              <Button mode="outlined" onPress={() => router.push('/funds/new')}>
                קרן חדשה
              </Button>
              <Button mode="outlined" onPress={() => router.push('/people')}>
                כרטסת
              </Button>
              <Button mode="outlined" onPress={() => router.push('/nedarim')}>
                סנכרון נדרים פלוס
              </Button>
            </View>
          </Panel>
        </Col>

        <Col flex={2}>
          <Panel
            title="קרנות"
            action={
              <Button compact mode="text" onPress={() => router.push('/funds')}>
                לכל הקרנות
              </Button>
            }
          >
            {activeFunds.length === 0 ? (
              <Text style={styles.empty}>עדיין לא נוצרו קרנות</Text>
            ) : (
              activeFunds.map((fund, index) => (
                <View key={fund.id}>
                  {index > 0 && <Divider style={styles.divider} />}
                  <Pressable onPress={() => router.push(`/funds/${fund.id}`)}>
                    {({ pressed }) => (
                      <View style={[styles.listRow, pressed && styles.pressed]}>
                        <View style={styles.listMain}>
                          <Text style={styles.listName}>{fund.name}</Text>
                          {fund.isGeneralFund && (
                            <Text style={styles.listTag}>קרן כללית</Text>
                          )}
                        </View>
                        <Text style={styles.listAmount}>{formatCurrency(fund.balance)}</Text>
                      </View>
                    )}
                  </Pressable>
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
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  listMain: { flex: 1 },
  listName: { fontSize: 14, color: palette.ink, fontWeight: '500' },
  listTag: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  listAmount: { fontSize: 14, fontWeight: '700', color: palette.neutralFigure },
  pressed: { opacity: 0.6 },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.sm },
  actions: { gap: spacing.sm },
});
