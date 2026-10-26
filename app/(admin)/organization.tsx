import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, ActivityIndicator } from 'react-native-paper';
import { useOrgSettings, updateOrgSettings } from '../../src/api/org';
import { Screen } from '../../src/components/layout/Screen';
import { Panel } from '../../src/components/layout/StatCard';
import { palette, spacing } from '../../src/theme';

export default function Organization() {
  const { settings, loading } = useOrgSettings();

  const [orgName, setOrgName] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [commission, setCommission] = useState('5');
  const [mosadId, setMosadId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loading) return;
    setOrgName(settings.orgName);
    setOrgNumber(settings.orgNumber);
    setCertNumber(settings.section46CertNumber);
    setCommission(String(settings.commissionPercentage));
    setMosadId(settings.nedarimMosadId ?? '');
  }, [loading, settings.updatedAt]);

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  const onSave = async () => {
    const pct = Number(commission);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('אחוז העמלה חייב להיות מספר בין 0 ל-100');
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateOrgSettings({
        orgName,
        orgNumber,
        section46CertNumber: certNumber,
        commissionPercentage: pct,
        nedarimMosadId: mosadId.trim(),
      });
      setSaved(true);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'השמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen back narrow title="הגדרות ארגון" subtitle="פרטי העמותה, עמלת התפעול והחיבור לנדרים פלוס">
      <Panel title="פרטי העמותה">
        <TextInput
          mode="outlined"
          label="שם העמותה / המוסד"
          value={orgName}
          onChangeText={setOrgName}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label='ח"פ / מספר עמותה'
          value={orgNumber}
          onChangeText={setOrgNumber}
          style={styles.input}
        />
        <TextInput
          mode="outlined"
          label="מספר אישור לפי סעיף 46"
          value={certNumber}
          onChangeText={setCertNumber}
          style={styles.input}
        />
        <Text style={styles.hint}>פרטים אלו נשלפים אוטומטית לכל קבלה שתופק.</Text>
      </Panel>

      <View style={styles.gap} />

      <Panel title="עמלת תפעול">
        <Text style={styles.hint}>
          נגבית אך ורק מתרומות שהגיעו דרך האפליקציה / נדרים פלוס, שבהן התורם בחר בעצמו את
          הקרן. תרומות מהבנק או מקובץ אקסל נכנסות במלואן לקרן, ללא ניכוי.
        </Text>
        <TextInput
          mode="outlined"
          label="אחוז עמלה"
          value={commission}
          onChangeText={setCommission}
          keyboardType="numeric"
          right={<TextInput.Affix text="%" />}
          style={styles.input}
        />
      </Panel>

      <View style={styles.gap} />

      <Panel title="נדרים פלוס">
        <TextInput
          mode="outlined"
          label="מספר מוסד (7 ספרות)"
          value={mosadId}
          onChangeText={setMosadId}
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.hint}>
          סיסמת ה-API אינה נשמרת כאן אלא בשרת בלבד, מטעמי אבטחה.
        </Text>

        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
        {saved && (
          <HelperText type="info" visible>
            ההגדרות נשמרו.
          </HelperText>
        )}

        <View style={styles.actions}>
          <Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>
            שמירת הגדרות
          </Button>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  gap: { height: spacing.md },
  input: { marginBottom: spacing.sm, backgroundColor: palette.surface },
  hint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
