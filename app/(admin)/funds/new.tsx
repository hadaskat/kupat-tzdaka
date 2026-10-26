import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Switch } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { createFund } from '../../../src/api/funds';
import { useAuth } from '../../../src/hooks/useAuth';
import { Screen } from '../../../src/components/layout/Screen';
import { Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

const schema = z.object({
  name: z.string().min(2, 'שם קצר מדי'),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewFund() {
  const router = useRouter();
  const { firebaseUid } = useAuth();
  const [isGeneralFund, setIsGeneralFund] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    if (!firebaseUid) return;
    setSubmitError(null);
    try {
      await createFund({
        name: values.name,
        description: values.description,
        isGeneralFund,
        createdBy: firebaseUid,
      });
      router.back();
    } catch {
      setSubmitError('יצירת הקרן נכשלה, נסו שוב');
    }
  };

  return (
    <Screen back narrow title="קרן חדשה" subtitle="קרן ייעודית לתרומות ולחלוקת תמיכות">
      <Panel title="פרטי הקרן">
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="שם הקרן"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value ?? ''}
              style={styles.input}
            />
          )}
        />
        <HelperText type="error" visible={!!errors.name}>
          {errors.name?.message}
        </HelperText>

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              mode="outlined"
              label="תיאור (אופציונלי)"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value ?? ''}
              style={styles.input}
              multiline
            />
          )}
        />

        <Text style={styles.hint}>
          חשוב: שם הקרן צריך להיות זהה לשם הקטגוריה בנדרים פלוס, כדי שהתרומות ישויכו אליה
          אוטומטית.
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.switchTitle}>קרן כללית</Text>
            <Text style={styles.switchHint}>
              הקרן התפעולית שאליה נכנסת עמלת התפעול. אמורה להיות קרן אחת בלבד.
            </Text>
          </View>
          <Switch value={isGeneralFund} onValueChange={setIsGeneralFund} />
        </View>

        <HelperText type="error" visible={!!submitError}>
          {submitError}
        </HelperText>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            יצירת קרן
          </Button>
          <Button mode="text" onPress={() => router.back()} disabled={isSubmitting}>
            ביטול
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: spacing.xs, backgroundColor: palette.surface },
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
