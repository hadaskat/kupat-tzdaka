import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, Button, HelperText, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFunds } from '../../../src/api/funds';
import { submitSupportRequest } from '../../../src/api/supportRequests';
import { useAuth } from '../../../src/hooks/useAuth';
import { Screen } from '../../../src/components/layout/Screen';
import { Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

export default function NewRequest() {
  const router = useRouter();
  const { firebaseUid, profile } = useAuth();
  const { funds } = useFunds();

  const [fundId, setFundId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleFunds = funds.filter((f) => f.active);

  const onSubmit = async () => {
    const numericAmount = Number(amount);
    if (!fundId) return setError('נא לבחור קרן');
    if (!numericAmount || numericAmount <= 0) return setError('נא להזין סכום חיובי');
    if (reason.trim().length < 10) return setError('נא לפרט את הנימוק (לפחות 10 תווים)');
    if (!firebaseUid) return;

    setError(null);
    setSubmitting(true);
    try {
      await submitSupportRequest({
        // Loans are out of scope for now; every request is a one-off grant.
        type: 'support',
        clientUserId: firebaseUid,
        clientName: profile?.fullName ?? '',
        fundId,
        requestedAmount: numericAmount,
        reason: reason.trim(),
      });
      router.back();
    } catch {
      setError('שליחת הבקשה נכשלה, נסו שוב');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen back narrow title="בקשת תמיכה" subtitle="הבקשה תיבדק על ידי הנהלת הקופה">
      <Panel title="פרטי הבקשה">
        <Text style={styles.label}>מאיזו קרן?</Text>
        {eligibleFunds.length === 0 ? (
          <Text style={styles.hint}>אין כרגע קרנות פעילות</Text>
        ) : (
          <View style={styles.chipsRow}>
            {eligibleFunds.map((f) => (
              <Chip
                key={f.id}
                selected={f.id === fundId}
                showSelectedCheck={false}
                onPress={() => setFundId(f.id)}
              >
                {f.name}
              </Chip>
            ))}
          </View>
        )}

        <TextInput
          mode="outlined"
          label="סכום מבוקש"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
        />

        <TextInput
          mode="outlined"
          label="נימוק הבקשה"
          value={reason}
          onChangeText={setReason}
          multiline
          numberOfLines={4}
          style={styles.input}
        />

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        <View style={styles.actions}>
          <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={submitting}>
            שליחת בקשה
          </Button>
          <Button mode="text" onPress={() => router.back()} disabled={submitting}>
            ביטול
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: palette.inkMuted, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: palette.inkFaint, marginBottom: spacing.md },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
