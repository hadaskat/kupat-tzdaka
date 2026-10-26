import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SettingsHeader } from '../../src/components/SettingsHeader';
import { Screen } from '../../src/components/layout/Screen';
import { Panel } from '../../src/components/layout/StatCard';
import { MenuRow } from '../../src/components/layout/MenuRow';
import { spacing } from '../../src/theme';

export default function Profile() {
  const router = useRouter();

  return (
    <Screen narrow title="הפרופיל שלי">
      <SettingsHeader />

      <View style={styles.gap} />

      <Panel title="הגדרות">
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
