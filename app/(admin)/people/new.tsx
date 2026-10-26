import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextInput, Button, HelperText, Chip } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { createPerson } from '../../../src/api/people';
import { Screen } from '../../../src/components/layout/Screen';
import { Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

const schema = z.object({
  fullName: z.string().min(2, 'שם קצר מדי'),
  phone: z.string().optional(),
  email: z.string().optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NewPerson() {
  const router = useRouter();
  const [isDonor, setIsDonor] = useState(true);
  const [isBeneficiary, setIsBeneficiary] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await createPerson({ ...values, isDonor, isBeneficiary });
      router.back();
    } catch {
      setSubmitError('ההוספה נכשלה, נסו שוב');
    }
  };

  const field = (name: keyof FormValues, label: string, keyboardType?: 'phone-pad') => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextInput
          mode="outlined"
          label={label}
          keyboardType={keyboardType}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value ?? ''}
          style={styles.input}
        />
      )}
    />
  );

  return (
    <Screen back narrow title="רשומה חדשה" subtitle="כרטיס אחד לכל אדם — תורם, נתמך או שניהם">
      <Panel title="פרטי הרשומה">
        {field('fullName', 'שם מלא')}
        <HelperText type="error" visible={!!errors.fullName}>
          {errors.fullName?.message}
        </HelperText>

        <Text style={styles.label}>סוג הרשומה</Text>
        <View style={styles.chipsRow}>
          <Chip selected={isDonor} showSelectedCheck={false} onPress={() => setIsDonor((v) => !v)}>
            תורם
          </Chip>
          <Chip
            selected={isBeneficiary}
            showSelectedCheck={false}
            onPress={() => setIsBeneficiary((v) => !v)}
          >
            נתמך
          </Chip>
        </View>
        <Text style={styles.hint}>
          ניתן לסמן את שניהם — אותו אדם יכול גם לתרום וגם לקבל תמיכה.
        </Text>

        {field('phone', 'טלפון', 'phone-pad')}
        {field('email', 'דוא״ל')}
        {field('idNumber', 'תעודת זהות')}
        {field('address', 'כתובת')}
        {field('notes', 'הערות')}

        <HelperText type="error" visible={!!submitError}>
          {submitError}
        </HelperText>

        {/* flex-start, not flex-end: the document is dir="rtl", so the row
            starts at the right - where the user asked actions to sit. */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            הוספה לכרטסת
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
  label: { fontSize: 13, color: palette.inkMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  chipsRow: { flexDirection: 'row', gap: spacing.sm },
  hint: { fontSize: 12, color: palette.inkFaint, marginTop: spacing.sm, marginBottom: spacing.md },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
