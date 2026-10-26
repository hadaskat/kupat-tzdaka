import { View, StyleSheet } from 'react-native';
import { Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOrgSettings } from '../../src/api/org';
import { SettingsHeader } from '../../src/components/SettingsHeader';
import { Screen, Row, Col } from '../../src/components/layout/Screen';
import { Panel } from '../../src/components/layout/StatCard';
import { MenuRow } from '../../src/components/layout/MenuRow';
import { palette, spacing } from '../../src/theme';

export default function Settings() {
  const { settings } = useOrgSettings();
  const router = useRouter();

  return (
    <Screen title="הגדרות" subtitle="ניהול המערכת, החיבורים וההרשאות">
      <SettingsHeader />

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title="הארגון והחיבורים">
            <MenuRow
              icon="office-building"
              title="הגדרות ארגון"
              description={
                settings.orgName
                  ? `${settings.orgName} · עמלה ${settings.commissionPercentage}%`
                  : 'טרם הוגדרו פרטי העמותה ואישור סעיף 46'
              }
              onPress={() => router.push('/organization')}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="sync"
              title="נדרים פלוס"
              description="סנכרון תרומות מהמערכת שלהם"
              onPress={() => router.push('/nedarim')}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="file-upload"
              title="ייבוא קבצים"
              description="דוחות מהבנק או מחברת האשראי"
              onPress={() => router.push('/import')}
            />
          </Panel>
        </Col>

        <Col flex={1}>
          <Panel title="משתמשים וביקורת">
            <MenuRow
              icon="account-cog"
              title="החשבון שלי"
              description="שינוי שם משתמש וסיסמה"
              onPress={() => router.push('/account')}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="account-multiple"
              title="ניהול משתמשים"
              description="הוספה ומחיקה של מי שיכול להתחבר"
              onPress={() => router.push('/users')}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="account-key"
              title="ניהול הרשאות"
              description="מי מפקח על כל קרן"
              onPress={() => router.push('/permissions')}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="clipboard-list-outline"
              title="יומן ביקורת"
              description="תיעוד כל פעולה רגישה במערכת"
              onPress={() => router.push('/audit')}
            />
          </Panel>
        </Col>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
});
