import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Divider,
  Button,
  Portal,
  Dialog,
  Chip,
  HelperText,
  SegmentedButtons,
  Checkbox,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useFund,
  useFunds,
  deleteFund,
  getFundDeletionImpact,
  type FundDeletionImpact,
} from '../../../../src/api/funds';
import { useFundLedger } from '../../../../src/api/ledger';
import { formatCurrency } from '../../../../src/utils/format';
import { Screen, Row, Col } from '../../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../../src/components/layout/StatCard';
import { Tag } from '../../../../src/components/layout/Tag';
import { MenuRow } from '../../../../src/components/layout/MenuRow';
import { palette, spacing } from '../../../../src/theme';

/** Overview + menu. Each action lives on its own screen so nothing is buried. */
export default function FundDetail() {
  const { fundId } = useLocalSearchParams<{ fundId: string }>();
  const { fund, loading } = useFund(fundId);
  const { funds } = useFunds();
  const { entries } = useFundLedger(fundId);
  const router = useRouter();

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'archive' | 'purge'>('archive');
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [impact, setImpact] = useState<FundDeletionImpact | null>(null);
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!fund) {
    return (
      <View style={styles.center}>
        <Text>הקרן לא נמצאה</Text>
      </View>
    );
  }

  const otherFunds = funds.filter((f) => f.id !== fund.id && f.active);
  const hasHistory = entries.length > 0;

  const totalIn = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);

  const openDeleteDialog = async () => {
    setTransferTo(null);
    setDeleteError(null);
    setDeleteMode('archive');
    setPurgeConfirm(false);
    setImpact(null);
    setDeleteVisible(true);
    try {
      const res = await getFundDeletionImpact(fund.id);
      setImpact(res.data);
    } catch {
      // The dialog still works without the preview; it only enriches the warning.
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteFund(fund.id, {
        mode: deleteMode,
        transferToFundId: deleteMode === 'archive' ? (transferTo ?? undefined) : undefined,
      });
      setDeleteVisible(false);
      router.replace('/funds');
    } catch (err) {
      setDeleteError((err as { message?: string })?.message ?? 'המחיקה נכשלה');
    } finally {
      setDeleting(false);
    }
  };

  const statusTags = [
    fund.isGeneralFund ? 'קרן כללית' : null,
    fund.closedAt ? 'סגורה' : !fund.active ? 'לא פעילה' : null,
  ].filter(Boolean) as string[];

  return (
    <Screen back title={fund.name} subtitle={statusTags.join(' · ') || 'קרן פעילה'}>
      <Row>
        <StatCard label="יתרה נוכחית" value={formatCurrency(fund.balance)} tone="accent" />
        <StatCard label="סך שנכנס" value={formatCurrency(totalIn)} tone="in" />
        <StatCard label="סך שיצא" value={formatCurrency(totalOut)} tone="out" />
        <StatCard label="תנועות ביומן" value={entries.length} />
      </Row>

      <View style={styles.gap} />

      <Row>
        <Col flex={1}>
          <Panel title="פעולות">
            <MenuRow
              icon="pencil"
              title="עריכת פרטי הקרן"
              description="שם ותיאור"
              onPress={() => router.push(`/funds/${fund.id}/edit`)}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="cash-plus"
              title="הוספת תרומה"
              description="מזומן או העברה בנקאית"
              onPress={() => router.push(`/funds/${fund.id}/add-donation`)}
            />
            <Divider style={styles.divider} />
            <MenuRow
              icon="format-list-bulleted"
              title="תנועות הקרן"
              description="תרומות שנכנסו ותמיכות שחולקו"
              onPress={() => router.push(`/funds/${fund.id}/transactions`)}
            />
          </Panel>
        </Col>

        <Col flex={1}>
          <Panel title="מצב הקרן">
            {statusTags.length > 0 && (
              <View style={styles.tagsRow}>
                {statusTags.map((t) => (
                  <Tag key={t} label={t} tone={t === 'קרן כללית' ? 'accent' : 'warn'} />
                ))}
              </View>
            )}
            <Text style={styles.note}>
              {hasHistory
                ? 'לקרן יש היסטוריית תנועות. סגירה תשמור את כל הרישומים לצורך ביקורת.'
                : 'הקרן עדיין ללא תנועות.'}
            </Text>
            <Button
              mode="outlined"
              icon="trash-can-outline"
              textColor={palette.moneyOut}
              onPress={openDeleteDialog}
              style={styles.deleteButton}
            >
              סגירה או מחיקה
            </Button>
          </Panel>
        </Col>
      </Row>

      <Portal>
        <Dialog visible={deleteVisible} onDismiss={() => setDeleteVisible(false)}>
          <Dialog.Title>"{fund.name}"</Dialog.Title>
          <Dialog.Content>
            <SegmentedButtons
              value={deleteMode}
              onValueChange={(v) => {
                setDeleteMode(v as 'archive' | 'purge');
                setPurgeConfirm(false);
                setDeleteError(null);
              }}
              buttons={[
                { value: 'archive', label: 'סגירה' },
                { value: 'purge', label: 'מחיקה לצמיתות' },
              ]}
              style={styles.modeSwitch}
            />

            {deleteMode === 'archive' ? (
              <>
                <Text variant="bodyMedium">
                  {hasHistory
                    ? 'הקרן תוסתר, וכל התנועות והתרומות יישמרו לצורך ביקורת.'
                    : 'הקרן מעולם לא הייתה בשימוש, ולכן פשוט תימחק.'}
                </Text>
                {fund.balance !== 0 && (
                  <>
                    <Text variant="bodyMedium" style={styles.transferPrompt}>
                      בקרן יש {formatCurrency(fund.balance)}. לאיזו קרן להעביר?
                    </Text>
                    <View style={styles.transferRow}>
                      {otherFunds.length === 0 ? (
                        <Text variant="bodySmall" style={styles.muted}>
                          אין קרן אחרת להעביר אליה — ניתן למחוק לצמיתות במקום.
                        </Text>
                      ) : (
                        otherFunds.map((f) => (
                          <Chip
                            key={f.id}
                            selected={transferTo === f.id}
                            onPress={() => setTransferTo(f.id)}
                          >
                            {f.name}
                          </Chip>
                        ))
                      )}
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <Text variant="bodyMedium">הקרן וכל מה שקשור אליה יימחקו ללא אפשרות שחזור:</Text>
                <View style={styles.impactBlock}>
                  <Text variant="bodySmall">
                    • יתרה שתימחק: {formatCurrency(impact?.balance ?? fund.balance)}
                  </Text>
                  <Text variant="bodySmall">• תרומות: {impact?.donations ?? '…'}</Text>
                  <Text variant="bodySmall">• בקשות תמיכה: {impact?.supportRequests ?? '…'}</Text>
                  <Text variant="bodySmall">• תנועות ביומן: {impact?.ledgerEntries ?? '…'}</Text>
                </View>
                <Text variant="bodySmall" style={styles.muted}>
                  סכומי התרומות והתמיכות של האנשים בכרטסת יעודכנו בהתאם.
                </Text>
                <Checkbox.Item
                  label="אני מבין/ה שהמידע יימחק לצמיתות"
                  status={purgeConfirm ? 'checked' : 'unchecked'}
                  onPress={() => setPurgeConfirm((v) => !v)}
                  position="leading"
                  style={styles.confirmBox}
                />
              </>
            )}

            <HelperText type="error" visible={!!deleteError}>
              {deleteError}
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteVisible(false)}>ביטול</Button>
            <Button
              textColor={palette.moneyOut}
              onPress={onDelete}
              loading={deleting}
              disabled={
                deleting ||
                (deleteMode === 'archive' && fund.balance !== 0 && !transferTo) ||
                (deleteMode === 'purge' && !purgeConfirm)
              }
            >
              {deleteMode === 'purge' ? 'מחיקה לצמיתות' : fund.balance !== 0 ? 'העברה וסגירה' : 'סגירה'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  note: { fontSize: 13, color: palette.inkMuted, lineHeight: 20 },
  deleteButton: { marginTop: spacing.md, borderColor: palette.moneyOut, alignSelf: 'flex-start' },
  modeSwitch: { marginBottom: spacing.md },
  transferPrompt: { marginTop: spacing.md },
  transferRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  impactBlock: { marginTop: spacing.sm, gap: spacing.xs },
  muted: { opacity: 0.7, marginTop: spacing.sm },
  confirmBox: { paddingHorizontal: 0, marginTop: spacing.sm },
});
