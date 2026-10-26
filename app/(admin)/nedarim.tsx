import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, HelperText, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useNedarimSyncState, syncNedarimPlus } from '../../src/api/nedarim';
import { useOrgSettings } from '../../src/api/org';
import type { NedarimSyncSummary } from '../../src/types/models';
import { Screen, Row, Col } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { palette, spacing } from '../../src/theme';

export default function Nedarim() {
  const { state, loading } = useNedarimSyncState();
  const { settings } = useOrgSettings();
  const router = useRouter();

  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NedarimSyncSummary | null>(null);

  const onSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await syncNedarimPlus();
      setResult(res.data);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'הסנכרון נכשל');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  const configured = !!settings.nedarimMosadId;
  const summary = result ?? state.lastResult;

  const summaryRow = (
    title: string,
    value: number,
    description?: string,
    attention = false
  ) => (
    <View style={styles.summaryRow}>
      <View style={styles.summaryText}>
        <Text style={styles.summaryTitle}>{title}</Text>
        {!!description && <Text style={styles.summaryDesc}>{description}</Text>}
      </View>
      <Text style={[styles.summaryValue, attention && styles.attention]}>{value}</Text>
    </View>
  );

  return (
    <Screen back title="נדרים פלוס" subtitle="משיכת תרומות מהמערכת של נדרים פלוס">
      {!configured && (
        <>
          <Panel title="חסרה הגדרה">
            <Text style={styles.hint}>
              יש להזין את מספר המוסד בנדרים פלוס במסך הגדרות ארגון, ולהגדיר את סיסמת ה-API
              בשרת.
            </Text>
            <Button
              mode="outlined"
              onPress={() => router.push('/organization')}
              style={styles.inlineButton}
            >
              להגדרות ארגון
            </Button>
          </Panel>
          <View style={styles.gap} />
        </>
      )}

      <Row>
        <StatCard
          label="סנכרון אחרון"
          value={state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleDateString('he-IL') : '—'}
          caption={
            state.lastSyncAt
              ? new Date(state.lastSyncAt).toLocaleTimeString('he-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'טרם בוצע'
          }
        />
        <StatCard
          label="עסקה אחרונה שנקלטה"
          value={state.lastTransactionId ?? '—'}
          caption="מזהה בנדרים פלוס"
        />
        <StatCard
          label="מספר מוסד"
          value={settings.nedarimMosadId || '—'}
          tone={configured ? 'accent' : 'out'}
        />
      </Row>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title="סנכרון תרומות">
            <Text style={styles.hint}>
              נמשכות רק עסקאות חדשות מאז הסנכרון הקודם, כך שאפשר להריץ שוב בכל עת בלי ליצור
              כפילויות.
            </Text>

            {!!state.lastError && (
              <HelperText type="error" visible>
                שגיאה בסנכרון הקודם: {state.lastError}
              </HelperText>
            )}
            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>

            <Button
              mode="contained"
              icon="sync"
              onPress={onSync}
              loading={syncing}
              disabled={syncing || !configured}
              style={styles.inlineButton}
            >
              סנכרון עכשיו
            </Button>
          </Panel>
        </Col>

        <Col flex={1}>
          {summary && (
            <Panel title={result ? 'תוצאות הסנכרון' : 'תוצאות הסנכרון הקודם'}>
              {summaryRow('עסקאות שנמשכו', summary.fetched)}
              <Divider style={styles.divider} />
              {summaryRow('תרומות חדשות שנקלטו', summary.created)}
              <Divider style={styles.divider} />
              {summaryRow('כבר היו במערכת', summary.duplicates, 'דילוג על כפילויות')}
              <Divider style={styles.divider} />
              {summaryRow(
                'ללא שיוך לקרן',
                summary.unmatchedFund,
                'נכנסו לקרן הכללית וממתינות לשיוך ידני',
                summary.unmatchedFund > 0
              )}
              <Divider style={styles.divider} />
              {summaryRow(
                'תרומות בדולר',
                summary.usd,
                'לא נכנסות ליתרה השקלית — לטיפול נפרד',
                summary.usd > 0
              )}
              {summary.missingDate > 0 && (
                <>
                  <Divider style={styles.divider} />
                  {summaryRow('ללא תאריך תקין', summary.missingDate, 'יש לבדוק ידנית', true)}
                </>
              )}
              {summary.skipped > 0 && (
                <>
                  <Divider style={styles.divider} />
                  {summaryRow(
                    'לא נקלטו',
                    summary.skipped,
                    'לא נמצאה קרן כללית לשייך אליה',
                    true
                  )}
                </>
              )}
              <Text style={styles.footnote}>
                התרומות שנקלטו ממתינות לאישור. האישור הוא מה שמעדכן את יתרת הקרן.
              </Text>
            </Panel>
          )}
        </Col>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.sm },
  inlineButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 14, color: palette.ink },
  summaryDesc: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  summaryValue: { fontSize: 16, fontWeight: '700', color: palette.ink },
  attention: { color: palette.moneyOut },
  footnote: { fontSize: 12, color: palette.inkFaint, marginTop: spacing.md, lineHeight: 18 },
});
