import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Chip, Divider, Button, TextInput, HelperText } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import {
  useSupportRequest,
  reviewSupportRequest,
  disburseSupportRequest,
  recordLoanRepayment,
} from '../../../src/api/supportRequests';
import { useFund } from '../../../src/api/funds';
import { usePeople } from '../../../src/api/people';
import { formatCurrency, requestStatusLabel, requestTypeLabel } from '../../../src/utils/format';
import { Screen, Row, Col } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

export default function RequestDetail() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { request, loading } = useSupportRequest(requestId);
  const { fund } = useFund(request?.fundId);
  const { people } = usePeople();

  const [approvedAmount, setApprovedAmount] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [pickedPersonId, setPickedPersonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPersonId = pickedPersonId ?? request?.personId ?? null;
  const beneficiaries = people.filter((p) => p.isBeneficiary);

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

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'הפעולה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  const onApprove = () =>
    run(() =>
      reviewSupportRequest({
        requestId: request.id,
        decision: 'approved',
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        personId: selectedPersonId ?? undefined,
      })
    );

  const onReject = () =>
    run(() => reviewSupportRequest({ requestId: request.id, decision: 'rejected' }));

  const onDisburse = () =>
    run(() => disburseSupportRequest(request.id, selectedPersonId ?? undefined));

  const onRepayment = () => {
    const amount = Number(repaymentAmount);
    if (!amount || amount <= 0) {
      setError('נא להזין סכום החזר חיובי');
      return;
    }
    return run(async () => {
      await recordLoanRepayment(request.id, amount);
      setRepaymentAmount('');
    });
  };

  // Shown at both decision and payout time: linking the request to a person is
  // what credits their totalReceived when the money actually goes out.
  const beneficiaryPicker = (
    <View style={styles.pickerBlock}>
      <Text style={styles.fieldLabel}>שיוך לנתמך (אופציונלי)</Text>
      {beneficiaries.length === 0 ? (
        <Text style={styles.hint}>אין נתמכים רשומים. ניתן להוסיף במסך "כרטסת".</Text>
      ) : (
        <View style={styles.chipsRow}>
          {beneficiaries.map((b) => (
            <Chip
              key={b.id}
              compact
              selected={b.id === selectedPersonId}
              showSelectedCheck={false}
              onPress={() => setPickedPersonId(b.id === selectedPersonId ? null : b.id)}
            >
              {b.fullName}
            </Chip>
          ))}
        </View>
      )}
    </View>
  );

  const details: [string, string][] = [
    ['קרן', fund ? `${fund.name} · יתרה ${formatCurrency(fund.balance)}` : '—'],
    ['סוג', requestTypeLabel(request.type)],
    ['סטטוס', requestStatusLabel(request.status)],
    ['תאריך הגשה', new Date(request.createdAt).toLocaleDateString('he-IL')],
  ];
  if (request.personId) {
    details.push([
      'נתמך משויך',
      people.find((b) => b.id === request.personId)?.fullName ?? '—',
    ]);
  }

  return (
    <Screen back title={request.clientName || 'בקשת תמיכה'} subtitle={requestTypeLabel(request.type)}>
      <Row>
        <StatCard label="סכום מבוקש" value={formatCurrency(request.requestedAmount)} tone="accent" />
        {request.approvedAmount != null && (
          <StatCard label="סכום שאושר" value={formatCurrency(request.approvedAmount)} />
        )}
        {request.type === 'loan' && request.repaidAmount != null && (
          <StatCard label="הוחזר עד כה" value={formatCurrency(request.repaidAmount)} tone="in" />
        )}
        <StatCard label="סטטוס" value={requestStatusLabel(request.status)} />
      </Row>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
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
        </Col>

        <Col flex={1}>
          {request.status === 'pending' && (
            <Panel title="החלטה">
              <TextInput
                mode="outlined"
                label={`סכום לאישור (ברירת מחדל: ${request.requestedAmount})`}
                value={approvedAmount}
                onChangeText={setApprovedAmount}
                keyboardType="numeric"
                style={styles.input}
              />
              {beneficiaryPicker}
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
              <View style={styles.actionsRow}>
                <Button mode="contained" onPress={onApprove} loading={busy} disabled={busy}>
                  אישור
                </Button>
                <Button mode="outlined" onPress={onReject} disabled={busy}>
                  דחייה
                </Button>
              </View>
            </Panel>
          )}

          {request.status === 'approved' && (
            <Panel title="תשלום בפועל">
              <Text style={styles.hint}>
                סימון כשולם יוריד את הסכום מיתרת הקרן. יש לבצע לאחר העברת הכסף בפועל.
              </Text>
              {beneficiaryPicker}
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
              <View style={styles.actionsRow}>
                <Button mode="contained" onPress={onDisburse} loading={busy} disabled={busy}>
                  סימון כשולם
                </Button>
              </View>
            </Panel>
          )}

          {request.status === 'inRepayment' && (
            <Panel title="רישום החזר הלוואה">
              <TextInput
                mode="outlined"
                label="סכום ההחזר"
                value={repaymentAmount}
                onChangeText={setRepaymentAmount}
                keyboardType="numeric"
                style={styles.input}
              />
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
              <View style={styles.actionsRow}>
                <Button mode="contained" onPress={onRepayment} loading={busy} disabled={busy}>
                  רישום החזר
                </Button>
              </View>
            </Panel>
          )}
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
  reason: { fontSize: 14, color: palette.ink, marginTop: spacing.xs, lineHeight: 21 },
  fieldLabel: { fontSize: 13, color: palette.inkMuted, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: palette.inkFaint, marginBottom: spacing.md, lineHeight: 18 },
  input: { marginBottom: spacing.md, backgroundColor: palette.surface },
  pickerBlock: { marginBottom: spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
});
