import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { usePerson, usePersonDonations, usePersonSupportRequests } from '../../../src/api/people';
import { useFunds } from '../../../src/api/funds';
import {
  formatCurrency,
  requestStatusLabel,
  donationStatusLabel,
} from '../../../src/utils/format';
import { Screen, Row, Col } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

export default function PersonDetail() {
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const { person, loading } = usePerson(personId);
  const { donations } = usePersonDonations(personId);
  const { requests } = usePersonSupportRequests(personId);
  const { funds } = useFunds();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={styles.center}>
        <Text>הרשומה לא נמצאה</Text>
      </View>
    );
  }

  const fundName = (id: string) => funds.find((f) => f.id === id)?.name ?? '—';
  const roles = [person.isDonor ? 'תורם' : null, person.isBeneficiary ? 'נתמך' : null]
    .filter(Boolean)
    .join(' · ');

  const details: [string, string | undefined][] = [
    ['טלפון', person.phone],
    ['דוא״ל', person.email],
    ['ת.ז', person.idNumber],
    ['כתובת', person.address],
    ['הערות', person.notes],
  ];

  return (
    <Screen back title={person.fullName} subtitle={roles}>
      <Row>
        <StatCard label="סה״כ תרם" value={formatCurrency(person.totalDonated)} tone="in" />
        <StatCard label="סה״כ קיבל" value={formatCurrency(person.totalReceived)} tone="out" />
        <StatCard label="תרומות" value={donations.length} tone="accent" />
        <StatCard label="בקשות תמיכה" value={requests.length} />
      </Row>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title="פרטי קשר">
            {details.filter(([, v]) => !!v).length === 0 ? (
              <Text style={styles.empty}>לא נשמרו פרטי קשר</Text>
            ) : (
              details
                .filter(([, v]) => !!v)
                .map(([label, value], i) => (
                  <View key={label}>
                    {i > 0 && <Divider style={styles.divider} />}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue}>{value}</Text>
                    </View>
                  </View>
                ))
            )}
          </Panel>
        </Col>

        <Col flex={2}>
          <Panel title={`תרומות (${donations.length})`}>
            {donations.length === 0 ? (
              <Text style={styles.empty}>אין תרומות רשומות</Text>
            ) : (
              donations.map((d, i) => (
                <View key={d.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.listRow}>
                    <View style={styles.listMain}>
                      <Text style={styles.listName}>{fundName(d.fundId)}</Text>
                      <Text style={styles.listMeta}>
                        {new Date(d.transactionDate).toLocaleDateString('he-IL')} ·{' '}
                        {donationStatusLabel(d.status)}
                      </Text>
                    </View>
                    <Text style={styles.amountIn}>{formatCurrency(d.grossAmount)}</Text>
                  </View>
                </View>
              ))
            )}
          </Panel>

          <View style={styles.gap} />

          <Panel title={`בקשות תמיכה (${requests.length})`}>
            {requests.length === 0 ? (
              <Text style={styles.empty}>אין בקשות רשומות</Text>
            ) : (
              requests.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <View style={styles.listRow}>
                    <View style={styles.listMain}>
                      <Text style={styles.listName}>{fundName(r.fundId)}</Text>
                      <Text style={styles.listMeta}>
                        {new Date(r.createdAt).toLocaleDateString('he-IL')} ·{' '}
                        {requestStatusLabel(r.status)}
                      </Text>
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  detailLabel: { fontSize: 13, color: palette.inkMuted },
  detailValue: { fontSize: 13, color: palette.ink, fontWeight: '500', flexShrink: 1 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  listMain: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: palette.ink },
  listMeta: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  amountIn: { fontSize: 14, fontWeight: '700', color: palette.moneyIn },
  amountOut: { fontSize: 14, fontWeight: '700', color: palette.moneyOut },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' },
});
