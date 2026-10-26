import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useMyPledges } from '../../src/api/donations';
import { useMySupportRequests } from '../../src/api/supportRequests';
import { formatCurrency } from '../../src/utils/format';
import { Screen, Row } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { spacing } from '../../src/theme';

export default function ClientHome() {
  const { profile, firebaseUid } = useAuth();
  const { donations } = useMyPledges(firebaseUid);
  const { requests } = useMySupportRequests(firebaseUid);
  const router = useRouter();

  const totalPledged = donations.reduce((sum, d) => sum + d.grossAmount, 0);
  const openRequests = requests.filter(
    (r) => r.status === 'pending' || r.status === 'approved' || r.status === 'inRepayment'
  ).length;

  return (
    <Screen title={`שלום ${profile?.fullName ?? ''}`} subtitle="ברוכים הבאים לקופת הצדקה">
      <Row>
        <StatCard label="סה״כ תרומות" value={formatCurrency(totalPledged)} tone="in" />
        <StatCard label="בקשות פתוחות" value={openRequests} tone="accent" />
      </Row>

      <View style={styles.gap} />

      <Panel title="פעולות">
        <View style={styles.actions}>
          <Button mode="contained" icon="heart" onPress={() => router.push('/donate')}>
            תרומה חדשה
          </Button>
          <Button mode="outlined" icon="file-document-edit" onPress={() => router.push('/requests/new')}>
            הגשת בקשת תמיכה
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
