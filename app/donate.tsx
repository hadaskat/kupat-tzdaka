import { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Chip,
  HelperText,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { usePublicFunds, createGuestDonation } from '../src/api/publicDonation';
import { useAuth } from '../src/hooks/useAuth';
import { formatCurrency } from '../src/utils/format';
import { Screen } from '../src/components/layout/Screen';
import { Panel } from '../src/components/layout/StatCard';
import { palette, spacing, card } from '../src/theme';

const QUICK_AMOUNTS = [50, 100, 180, 360, 1000];

/**
 * Public donation screen (spec §6.1) - deliberately outside the (auth) guard so
 * a donor can give without creating an account.
 */
export default function PublicDonate() {
  const { funds, loading, error: fundsError } = usePublicFunds();
  const { isAuthenticated, profile } = useAuth();
  const router = useRouter();

  const [fundId, setFundId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<'once' | 'monthly'>('once');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedFund = funds.find((f) => f.id === fundId);

  const onSubmit = async () => {
    const numericAmount = Number(amount);
    if (!fundId) return setError('נא לבחור קרן');
    if (!numericAmount || numericAmount <= 0) return setError('נא להזין סכום חיובי');
    if (fullName.trim().length < 2) return setError('נא להזין שם מלא');
    if (!phone.trim() && !email.trim()) return setError('נא להזין טלפון או דוא״ל לקבלת הקבלה');

    setError(null);
    setSubmitting(true);
    try {
      await createGuestDonation({
        fundId,
        amount: numericAmount,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        isRecurring: frequency === 'monthly',
        note: note.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'שליחת התרומה נכשלה, נסו שוב');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  if (done) {
    return (
      <Screen narrow title="תודה רבה!">
        <Panel>
          <Text style={styles.doneText}>
            התרומה על סך {formatCurrency(Number(amount) || 0)} לקרן "{selectedFund?.name}" נרשמה.
          </Text>
          <Text style={styles.hint}>
            בשלב הבא תועברו לדף התשלום המאובטח של נדרים פלוס. עם השלמת התשלום תישלח אליכם קבלה
            רשמית לפי סעיף 46.
          </Text>
          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={() => {
                setDone(false);
                setAmount('');
                setFullName('');
                setPhone('');
                setEmail('');
                setNote('');
                setFundId(null);
              }}
            >
              תרומה נוספת
            </Button>
            {!isAuthenticated && (
              <Button mode="text" onPress={() => router.push('/(auth)/login')}>
                כניסה לאזור האישי
              </Button>
            )}
          </View>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen narrow title="תרומה" subtitle="ניתן לתרום ללא צורך בהרשמה">
      {!!fundsError && (
        <HelperText type="error" visible>
          {fundsError}
        </HelperText>
      )}

      <Panel title="לאיזו קרן לתרום?">
        {funds.length === 0 && !fundsError ? (
          <Text style={styles.hint}>אין כרגע קרנות פתוחות לתרומה</Text>
        ) : (
          <View style={styles.fundList}>
            {funds.map((f) => (
              <Pressable key={f.id} onPress={() => setFundId(f.id)}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.fundCard,
                      f.id === fundId && styles.fundCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.fundName}>{f.name}</Text>
                    {!!f.description && (
                      <Text style={styles.fundDescription}>{f.description}</Text>
                    )}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </Panel>

      <View style={styles.gap} />

      <Panel title="סכום">
        <View style={styles.chipsRow}>
          {QUICK_AMOUNTS.map((a) => (
            <Chip
              key={a}
              selected={amount === String(a)}
              showSelectedCheck={false}
              onPress={() => setAmount(String(a))}
            >
              {a} ₪
            </Chip>
          ))}
        </View>
        <TextInput
          mode="outlined"
          label="סכום אחר"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
        />
        <SegmentedButtons
          value={frequency}
          onValueChange={(v) => setFrequency(v as 'once' | 'monthly')}
          buttons={[
            { value: 'once', label: 'תרומה חד־פעמית' },
            { value: 'monthly', label: 'הוראת קבע חודשית' },
          ]}
          style={styles.input}
        />
      </Panel>

      <View style={styles.gap} />

      <Panel title="פרטים לקבלה">
        <TextInput
          mode="outlined"
          label="שם מלא"
          value={fullName}
          onChangeText={setFullName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="טלפון"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="דוא״ל"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <Text style={styles.hint}>
          נדרש טלפון או דוא״ל אחד לפחות, כדי שנוכל לשלוח את הקבלה.
        </Text>
        <TextInput
          mode="outlined"
          label="הקדשה / הערה (אופציונלי)"
          value={note}
          onChangeText={setNote}
          style={styles.input}
        />

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        <View style={styles.actions}>
          <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={submitting}>
            המשך לתשלום
          </Button>
          {!isAuthenticated && (
            <Button mode="text" onPress={() => router.push('/(auth)/login')}>
              יש לי חשבון — כניסה
            </Button>
          )}
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 64 },
  gap: { height: spacing.md },
  fundList: { gap: spacing.sm },
  fundCard: { ...card, borderRadius: 10, padding: spacing.md },
  fundCardSelected: { borderColor: palette.accent, borderWidth: 2, backgroundColor: palette.accentSoft },
  fundName: { fontSize: 14, fontWeight: '600', color: palette.ink },
  fundDescription: { fontSize: 12, color: palette.inkFaint, marginTop: 4, lineHeight: 18 },
  pressed: { opacity: 0.7 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.sm },
  doneText: { fontSize: 15, color: palette.ink, lineHeight: 22, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
