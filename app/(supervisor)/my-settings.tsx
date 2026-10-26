import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SettingsHeader } from '../../src/components/SettingsHeader';
import { Screen } from '../../src/components/layout/Screen';
import { Panel } from '../../src/components/layout/StatCard';
import { MenuRow } from '../../src/components/layout/MenuRow';
import { spacing } from '../../src/theme';

/**
 * Named "my-settings" rather than "account": Expo Router groups share one URL
 * space, so a route named "account" here would shadow the shared /account
 * screen this very page links to.
 */
export default function SupervisorSettings() {
  const router = useRouter();

  return (
    <Screen narrow title="הגדרות">
      <SettingsHeader />

      <View style={styles.gap} />

      <Panel title="החשבון">
        <MenuRow
          icon="account-cog"
          title="החשבון שלי"
          description="שינוי שם משתמש וסיסמה"
          onPress={() => router.push('/account')}
        />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
});
