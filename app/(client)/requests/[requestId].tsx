import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useSupportRequest } from '../../../src/api/supportRequests';
import { useFund } from '../../../src/api/funds';
import { formatCurrency, requestStatusLabel, requestTypeLabel } from '../../../src/utils/format';
import { Screen, Row } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

export default function MyRequestDetail() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { request, loading } = useSupportRequest(requestId);
  const { fund } = useFund(request?.fundId);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text>הבקשה לא נמצאה</Text>
      </View>
    );
  }

  const details: [string, string][] = [
    ['קרן', fund?.name ?? '—'],
    ['סטטוס', requestStatusLabel(request.status)],
    ['תאריך הגשה', new Date(request.createdAt).toLocaleString('he-IL')],
  ];

  return (
    <Screen back title={requestTypeLabel(request.type)} subtitle={requestStatusLabel(request.status)}>
      <Row>
        <StatCard label="סכום מבוקש" value={formatCurrency(request.requestedAmount)} tone="accent" />
        {request.approvedAmount != null && (
          <StatCard label="סכום שאושר" value={formatCurrency(request.approvedAmount)} tone="in" />
        )}
        {request.type === 'loan' && request.repaidAmount != null && (
          <StatCard label="הוחזר עד כה" value={formatCurrency(request.repaidAmount)} />
        )}
      </Row>

      <View style={styles.gap} />

      <Panel title="פרטי הבקשה">
        {details.map(([label, value], i) => (
          <View key={label}>
            {i > 0 && <Divider style={styles.divider} />}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{label}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          </View>
        ))}
        <Divider style={styles.divider} />
        <Text style={styles.detailLabel}>נימוק</Text>
        <Text style={styles.reason}>{request.reason}</Text>
      </Panel>
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
  reason: { fontSize: 14, color: palette.ink, marginTop: spacing.xs, lineHeight: 21 },
});
