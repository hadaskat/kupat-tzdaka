import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Button, Divider, Chip } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import {
  useImportedFile,
  useDonationsForFile,
  confirmDonation,
  rejectDonation,
  bulkConfirmDonations,
} from '../../../src/api/imports';
import { useFunds } from '../../../src/api/funds';
import { formatCurrency, donationStatusLabel } from '../../../src/utils/format';
import type { Donation } from '../../../src/types/models';
import { Screen, Row } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { Tag } from '../../../src/components/layout/Tag';
import { palette, spacing } from '../../../src/theme';

function DonationRow({
  donation,
  fundOptions,
}: {
  donation: Donation;
  fundOptions: { id: string; name: string }[];
}) {
  const [selectedFundId, setSelectedFundId] = useState(donation.fundId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = donation.status === 'pendingMatch' || donation.status === 'matched';

  const onConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmDonation(donation.id, { fundId: selectedFundId });
    } catch {
      setError('האישור נכשל');
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    setBusy(true);
    setError(null);
    try {
      await rejectDonation(donation.id);
    } catch {
      setError('הדחייה נכשלה');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.donationBlock}>
      <View style={styles.headRow}>
        <View style={styles.headMain}>
          <Text style={styles.donor}>{donation.donorNameRaw || 'ללא שם'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {new Date(donation.transactionDate).toLocaleDateString('he-IL')}
            </Text>
            <Tag label={donationStatusLabel(donation.status)} />
            {donation.possibleDuplicate && <Tag label="כפילות אפשרית" tone="warn" />}
          </View>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amount}>{formatCurrency(donation.grossAmount)}</Text>
          {donation.feeAmount > 0 && (
            <Text style={styles.meta}>
              לקרן {formatCurrency(donation.netAmount)} · עמלה{' '}
              {formatCurrency(donation.feeAmount)}
            </Text>
          )}
        </View>
      </View>

      {!!donation.rawMessage && <Text style={styles.message}>"{donation.rawMessage}"</Text>}

      {canAct && (
        <>
          <Text style={styles.fundLabel}>שיוך לקרן</Text>
          <View style={styles.fundChipsRow}>
            {fundOptions.map((f) => (
              <Chip
                key={f.id}
                compact
                selected={f.id === selectedFundId}
                showSelectedCheck={false}
                onPress={() => setSelectedFundId(f.id)}
              >
                {f.name}
              </Chip>
            ))}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actionsRow}>
            <Button mode="contained" onPress={onConfirm} loading={busy} disabled={busy} compact>
              אישור
            </Button>
            <Button mode="outlined" onPress={onReject} disabled={busy} compact>
              דחייה
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

export default function ImportReview() {
  const { importId } = useLocalSearchParams<{ importId: string }>();
  const { file, loading: fileLoading } = useImportedFile(importId);
  const { donations, loading: donationsLoading } = useDonationsForFile(importId);
  const { funds } = useFunds();
  const [bulkBusy, setBulkBusy] = useState(false);

  const fundOptions = funds.map((f) => ({ id: f.id, name: f.name }));
  const autoMatchedIds = donations.filter((d) => d.status === 'matched').map((d) => d.id);

  const onBulkConfirm = async () => {
    setBulkBusy(true);
    try {
      await bulkConfirmDonations(autoMatchedIds);
    } finally {
      setBulkBusy(false);
    }
  };

  if (fileLoading || donationsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Screen back title={file?.fileName ?? 'סקירת ייבוא'} subtitle="אישור ושיוך של השורות שנקלטו">
      <Row>
        <StatCard label="שורות בקובץ" value={file?.rowCount ?? 0} tone="accent" />
        <StatCard label="שויכו אוטומטית" value={file?.matchedCount ?? 0} tone="in" />
        <StatCard label="דורשות שיוך ידני" value={file?.unmatchedCount ?? 0} tone="out" />
      </Row>

      <View style={styles.gap} />

      <Panel
        title={`שורות (${donations.length})`}
        action={
          autoMatchedIds.length > 0 ? (
            <Button mode="contained" compact onPress={onBulkConfirm} loading={bulkBusy} disabled={bulkBusy}>
              אישור כל ההתאמות ({autoMatchedIds.length})
            </Button>
          ) : undefined
        }
      >
        {donations.length === 0 ? (
          <Text style={styles.empty}>אין שורות בקובץ זה</Text>
        ) : (
          donations.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <Divider style={styles.divider} />}
              <DonationRow donation={item} fundOptions={fundOptions} />
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.page },
  gap: { height: spacing.md },
  divider: { backgroundColor: palette.line },
  donationBlock: { paddingVertical: spacing.sm + 2 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  headMain: { flex: 1 },
  donor: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  meta: { fontSize: 12, color: palette.inkFaint },
  amountBlock: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700', color: palette.ink },
  message: { fontSize: 12, color: palette.inkMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  fundLabel: { fontSize: 12, color: palette.inkMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  fundChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  error: { color: palette.moneyOut, fontSize: 12, marginTop: spacing.sm },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
