import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { loginWithUsername } from '../../src/api/auth';
import { describeAuthError } from '../../src/utils/authErrors';
import { palette, spacing, card } from '../../src/theme';

const schema = z.object({
  username: z.string().min(3, 'שם משתמש קצר מדי'),
  password: z.string().min(6, 'סיסמה קצרה מדי'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await loginWithUsername(values.username, values.password);
    } catch (error) {
      setSubmitError(describeAuthError(error));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.card}>
          <Text style={styles.brand}>קופת צדקה</Text>
          <Text style={styles.title}>{t('auth.loginTitle')}</Text>

          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label={t('auth.username')}
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value ?? ''}
                style={styles.input}
              />
            )}
          />
          <HelperText type="error" visible={!!errors.username}>
            {errors.username?.message}
          </HelperText>

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                mode="outlined"
                label={t('auth.password')}
                secureTextEntry
                onBlur={onBlur}
                onChangeText={onChange}
                value={value ?? ''}
                style={styles.input}
              />
            )}
          />
          <HelperText type="error" visible={!!errors.password}>
            {errors.password?.message}
          </HelperText>

          <HelperText type="error" visible={!!submitError}>
            {submitError}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.button}
          >
            {t('auth.loginButton')}
          </Button>

          <View style={styles.links}>
            <Link href="/(auth)/register" style={styles.link}>
              <Text style={styles.linkText}>{t('auth.noAccount')}</Text>
            </Link>
            {/* Donating never requires an account (spec §6.1). */}
            <Link href="/donate" style={styles.link}>
              <Text style={styles.linkText}>לתרומה ללא הרשמה</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.page },
  page: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: palette.page,
  },
  card: { ...card, padding: spacing.xl, width: '100%', maxWidth: 420 },
  brand: { fontSize: 13, fontWeight: '700', color: palette.accent, textAlign: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.ink,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  input: { backgroundColor: palette.surface },
  button: { marginTop: spacing.sm },
  links: { marginTop: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  link: { alignSelf: 'center' },
  linkText: { fontSize: 13, color: palette.accent },
});
