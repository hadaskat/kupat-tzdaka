import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, HelperText } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFund } from '../../../../src/api/funds';
import { addManualDonation } from '../../../../src/api/donations';
import { formatCurrency } from '../../../../src/utils/format';
import { Screen } from '../../../../src/components/layout/Screen';
import { Panel } from '../../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../../src/theme';

export default function AddDonation() {
  const { fundId } = useLocalSearchParams<{ fundId: string }>();
  const { fund, loading } = useFund(fundId);
  const router = useRouter();

  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (!fund) {
    return (
      <View style={styles.center}>
        <Text>הקרן לא נמצאה</Text>
      </View>
    );
  }

  const onSubmit = async () => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('נא להזין סכום חיובי');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addManualDonation({
        fundId: fund.id,
        amount: numericAmount,
        transactionDate: Date.now(),
        donorNameRaw: donorName.trim() || undefined,
        createPersonIfMissing: !!donorName.trim(),
        rawMessage: note.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'הוספת התרומה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      back
      narrow
      title="הוספת תרומה"
      subtitle={`${fund.name} · יתרה נוכחית ${formatCurrency(fund.balance)}`}
    >
      <Panel title="פרטי התרומה">
        <Text style={styles.hint}>
          לרישום מזומן או העברה בנקאית. הסכום המלא נכנס לקרן, ללא ניכוי עמלה. תרומות מנדרים
          פלוס ייקלטו אוטומטית ואין צורך לרשום אותן כאן.
        </Text>

        <TextInput
          mode="outlined"
          label="שם התורם (אופציונלי)"
          value={donorName}
          onChangeText={setDonorName}
          style={styles.input}
        />
        <Text style={styles.hint}>
          אם קיים תורם בשם זה בכרטסת — התרומה תצורף לכרטיס שלו. אחרת ייווצר כרטיס חדש.
        </Text>

        <TextInput
          mode="outlined"
          label="סכום"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="הערה (אופציונלי)"
          value={note}
          onChangeText={setNote}
          style={styles.input}
        />

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        <View style={styles.actions}>
          <Button mode="contained" onPress={onSubmit} loading={saving} disabled={saving}>
            הוספת תרומה
          </Button>
          <Button mode="text" onPress={() => router.back()} disabled={saving}>
            ביטול
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
