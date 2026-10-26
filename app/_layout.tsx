import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import { ensureRTL, applyWebTextAlignFix } from '../src/utils/rtl';
import { theme, palette } from '../src/theme';
import '../src/i18n';

// Runs at module load, before the first render - React Native Web bakes text
// alignment into its generated styles, so doing this in an effect is too late.
ensureRTL();

export default function RootLayout() {
  // Runs after the first paint, once React Native Web has emitted its
  // stylesheet and there is a rule to override.
  useEffect(() => {
    applyWebTextAlignFix();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <PaperProvider theme={theme}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                headerStyle: { backgroundColor: palette.surface },
                headerTintColor: palette.ink,
                headerTitleStyle: { fontWeight: '600' },
                contentStyle: { backgroundColor: palette.page },
              }}
            >
              {/* Pushed from every role's settings menu, so it needs a header
                  with a back affordance of its own. */}
              <Stack.Screen
                name="account"
                options={{ headerShown: true, title: 'החשבון שלי' }}
              />
            </Stack>
          </PaperProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
