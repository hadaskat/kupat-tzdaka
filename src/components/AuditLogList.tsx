import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { useAuditLog } from '../api/supervision';
import { Screen } from './layout/Screen';
import { Panel } from './layout/StatCard';
import { palette, spacing } from '../theme';

const ACTION_LABELS: Record<string, string> = {
  'donation.confirm': 'אישור תרומה',
  'donation.bulkConfirm': 'אישור מרוכז של תרומות',
  'donation.createManual': 'רישום תרומה ידנית',
  'supportRequest.approved': 'אישור בקשת תמיכה',
  'supportRequest.rejected': 'דחיית בקשת תמיכה',
  'supportRequest.disburse': 'סימון תמיכה כשולמה',
  'user.setRole': 'שינוי תפקיד משתמש',
  'user.setFundPermissions': 'שינוי שיוך קרנות',
  'orgSettings.update': 'עדכון הגדרות ארגון',
  'fund.create': 'יצירת קרן',
  'fund.update': 'עריכת קרן',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * @param fundIds null for the super admin (whole log), or the supervisor's
 *                scoped fund list.
 * @param back    true when the screen was pushed (the admin reaches it from the
 *                settings menu); false when it is a top-level tab.
 */
export function AuditLogList({
  fundIds,
  back = false,
}: {
  fundIds: string[] | null;
  back?: boolean;
}) {
  const { entries, loading } = useAuditLog(fundIds);

  return (
    <Screen back={back} title="יומן ביקורת" subtitle="תיעוד כל פעולה רגישה במערכת">
      <Panel title={loading ? 'טוען…' : `${entries.length} רשומות`}>
        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>אין עדיין רשומות ביומן</Text>
        ) : (
          entries.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider style={styles.divider} />}
              <View style={styles.row}>
                <Text style={styles.action}>{actionLabel(item.action)}</Text>
                <Text style={styles.meta}>
                  {new Date(item.timestamp).toLocaleString('he-IL')}
                </Text>
              </View>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.lg },
  divider: { backgroundColor: palette.line },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  action: { fontSize: 14, color: palette.ink, flex: 1 },
  meta: { fontSize: 12, color: palette.inkFaint },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
