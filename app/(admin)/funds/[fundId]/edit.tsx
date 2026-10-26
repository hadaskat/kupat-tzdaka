import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, Switch, ActivityIndicator, HelperText } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFund, updateFund } from '../../../../src/api/funds';
import { Screen } from '../../../../src/components/layout/Screen';
import { Panel } from '../../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../../src/theme';

export default function EditFund() {
  const { fundId } = useLocalSearchParams<{ fundId: string }>();
  const { fund, loading } = useFund(fundId);
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [isGeneralFund, setIsGeneralFund] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fund) return;
    setName(fund.name);
    setDescription(fund.description ?? '');
    setActive(fund.active);
    setIsGeneralFund(fund.isGeneralFund ?? false);
    setDirty(false);
  }, [fund?.id]);

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

  const onSave = async () => {
    if (name.trim().length < 2) {
      setError('שם הקרן קצר מדי');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateFund(fund.id, {
        name: name.trim(),
        description,
        isGeneralFund,
        active,
      });
      router.back();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'השמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const track = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setDirty(true);
  };

  return (
    <Screen back narrow title="עריכת קרן" subtitle={fund.name}>
      <Panel title="פרטי הקרן">
        <TextInput
          mode="outlined"
          label="שם הקרן"
          value={name}
          onChangeText={track(setName)}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="תיאור"
          value={description}
          onChangeText={track(setDescription)}
          style={styles.input}
          multiline
        />
        <Text style={styles.hint}>
          חשוב: שם הקרן צריך להיות זהה לשם הקטגוריה בנדרים פלוס, כדי שהתרומות ישויכו אליה
          אוטומטית. שינוי השם כאן ישפיע על השיוך של תרומות עתידיות.
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>קרן פעילה</Text>
          </View>
          <Switch value={active} onValueChange={track(setActive)} />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>קרן כללית</Text>
            <Text style={styles.switchHint}>
              יעד עמלת התפעול, וגם הקרן שאליה נכנסות תרומות מיובאות שלא זוהתה להן קרן.
            </Text>
          </View>
          <Switch value={isGeneralFund} onValueChange={track(setIsGeneralFund)} />
        </View>

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        <View style={styles.actions}>
          <Button mode="contained" onPress={onSave} loading={saving} disabled={saving || !dirty}>
            שמירת שינויים
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
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.sm,
    gap: spacing.md,
  },
  switchLabel: { flex: 1 },
  switchTitle: { fontSize: 14, color: palette.ink, fontWeight: '500' },
  switchHint: { fontSize: 12, color: palette.inkFaint, marginTop: 2, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
