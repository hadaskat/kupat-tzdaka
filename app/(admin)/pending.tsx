import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Menu, HelperText, Divider, Checkbox } from 'react-native-paper';
import {
  usePendingDonations,
  confirmDonation,
  bulkConfirmDonations,
  rejectDonation,
} from '../../src/api/imports';
import { useFunds } from '../../src/api/funds';
import { formatCurrency } from '../../src/utils/format';
import { Screen, Row } from '../../src/components/layout/Screen';
import { StatCard, Panel } from '../../src/components/layout/StatCard';
import { palette, spacing } from '../../src/theme';
import type { Donation, Fund } from '../../src/types/models';

const SOURCE_LABELS: Record<string, string> = {
  nedarimPlus: 'נדרים פלוס',
  bankImport: 'ייבוא בנק',
  creditCardImport: 'ייבוא אשראי',
  manualAdmin: 'רישום ידני',
  clientPledge: 'הבטחה',
};

function Tag({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'warn' | 'info' }) {
  return (
    <View style={[styles.tag, tone === 'warn' && styles.tagWarn, tone === 'info' && styles.tagInfo]}>
      <Text
        style={[
          styles.tagText,
          tone === 'warn' && styles.tagTextWarn,
          tone === 'info' && styles.tagTextInfo,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function PendingRow({
  donation,
  funds,
  selected,
  onToggleSelect,
  onError,
  isLast,
}: {
  donation: Donation;
  funds: Fund[];
  selected: boolean;
  onToggleSelect: () => void;
  onError: (m: string | null) => void;
  isLast: boolean;
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [fundId, setFundId] = useState(donation.fundId);
  const [busy, setBusy] = useState(false);

  const fundName = funds.find((f) => f.id === fundId)?.name ?? '—';

  const act = async (fn: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError((err as { message?: string })?.message ?? failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={styles.row}>
        <Checkbox status={selected ? 'checked' : 'unchecked'} onPress={onToggleSelect} />

        <View style={styles.rowMain}>
          <Text style={styles.donor}>{donation.donorNameRaw || 'ללא שם'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {donation.transactionDate
                ? new Date(donation.transactionDate).toLocaleDateString('he-IL')
                : 'ללא תאריך'}
            </Text>
            <Tag text={SOURCE_LABELS[donation.source] ?? donation.source} />
            {donation.isRecurring && <Tag text="הוראת קבע" tone="info" />}
            {donation.currency === 'USD' && <Tag text="דולר" tone="warn" />}
            {donation.possibleDuplicate && <Tag text="חשד לכפילות" tone="warn" />}
            {donation.needsDateReview && <Tag text="תאריך לא ברור" tone="warn" />}
          </View>
        </View>

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)}>
              <View style={styles.fundPicker}>
                <Text style={styles.fundPickerText}>{fundName}</Text>
              </View>
            </Pressable>
          }
        >
          {funds.map((f) => (
            <Menu.Item
              key={f.id}
              title={f.name}
              onPress={() => {
                setFundId(f.id);
                setMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        <Text style={styles.amount}>{formatCurrency(donation.grossAmount)}</Text>

        <View style={styles.rowActions}>
          <Button
            mode="contained"
            compact
            loading={busy}
            disabled={busy}
            onPress={() => act(() => confirmDonation(donation.id, { fundId }), 'האישור נכשל')}
          >
            אישור
          </Button>
          <Button
            mode="text"
            compact
            disabled={busy}
            textColor={palette.inkMuted}
            onPress={() => act(() => rejectDonation(donation.id), 'הדחייה נכשלה')}
          >
            דחייה
          </Button>
        </View>
      </View>
      {!isLast && <Divider style={styles.divider} />}
    </View>
  );
}

export default function PendingDonations() {
  const { donations, loading } = usePendingDonations();
  const { funds } = useFunds();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFunds = useMemo(() => funds.filter((f) => f.active), [funds]);
  const total = donations.reduce((sum, d) => sum + d.grossAmount, 0);
  const unassigned = donations.filter((d) => d.matchConfidence === 0).length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onBulkConfirm = async () => {
    setBulkBusy(true);
    setError(null);
    try {
      const res = await bulkConfirmDonations([...selected]);
      const failed = (res.data as { failed?: unknown[] })?.failed ?? [];
      if (failed.length > 0) setError(`${failed.length} תרומות לא אושרו. נסו שוב.`);
      setSelected(new Set());
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'האישור המרוכז נכשל');
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Screen title="תרומות ממתינות" subtitle="הכסף נכנס ליתרת הקרן רק לאחר אישור">
      <Row>
        <StatCard label="ממתינות" value={donations.length} tone="accent" />
        <StatCard label="סכום כולל" value={formatCurrency(total)} tone="in" />
        <StatCard
          label="ללא שיוך אוטומטי"
          value={unassigned}
          caption="דורשות בחירת קרן ידנית"
          tone={unassigned > 0 ? 'out' : 'neutral'}
        />
      </Row>

      <View style={styles.gap} />

      <Panel
        title={selected.size > 0 ? `${selected.size} נבחרו` : 'רשימת התרומות'}
        action={
          donations.length > 0 ? (
            <View style={styles.panelActions}>
              <Button
                compact
                mode="text"
                onPress={() =>
                  setSelected((prev) =>
                    prev.size === donations.length
                      ? new Set()
                      : new Set(donations.map((d) => d.id))
                  )
                }
              >
                {selected.size === donations.length ? 'ביטול בחירה' : 'בחירת הכל'}
              </Button>
              <Button
                compact
                mode="contained"
                onPress={onBulkConfirm}
                loading={bulkBusy}
                disabled={bulkBusy || selected.size === 0}
              >
                אישור הנבחרות
              </Button>
            </View>
          ) : undefined
        }
      >
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>

        {donations.length === 0 ? (
          <Text style={styles.empty}>אין תרומות הממתינות לטיפול</Text>
        ) : (
          donations.map((d, i) => (
            <PendingRow
              key={d.id}
              donation={d}
              funds={activeFunds}
              selected={selected.has(d.id)}
              onToggleSelect={() => toggle(d.id)}
              onError={setError}
              isLast={i === donations.length - 1}
            />
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  panelActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  rowMain: { flex: 1, minWidth: 140 },
  donor: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: palette.inkFaint },

  fundPicker: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    backgroundColor: palette.page,
  },
  fundPickerText: { fontSize: 12, color: palette.ink },

  amount: { fontSize: 15, fontWeight: '700', color: palette.neutralFigure, minWidth: 80, textAlign: 'left' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  divider: { backgroundColor: palette.line },

  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.page,
  },
  tagWarn: { backgroundColor: '#FEF3C7' },
  tagInfo: { backgroundColor: palette.accentSoft },
  tagText: { fontSize: 11, color: palette.inkMuted },
  tagTextWarn: { color: '#92400E' },
  tagTextInfo: { color: palette.accentDark },

  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.md, textAlign: 'center' },
});
