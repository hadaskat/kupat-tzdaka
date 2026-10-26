import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import {
  Text,
  ActivityIndicator,
  Chip,
  Button,
  HelperText,
  Searchbar,
  Divider,
  Portal,
  Modal,
} from 'react-native-paper';
import { useAllUsers, setFundSupervisors, setUserRole } from '../../src/api/org';
import { useFunds } from '../../src/api/funds';
import { useAuth } from '../../src/hooks/useAuth';
import { normalizeName } from '../../src/utils/normalizeName';
import type { AppUser, Fund } from '../../src/types/models';
import { Screen, Row, Col } from '../../src/components/layout/Screen';
import { Panel } from '../../src/components/layout/StatCard';
import { Tag } from '../../src/components/layout/Tag';
import { palette, spacing } from '../../src/theme';

/**
 * One block per fund: who may supervise it. Adding someone here is also how a
 * new fund manager is created - picking a plain client promotes them.
 */
function FundPermissionRow({
  fund,
  users,
  onOpenPicker,
  onRemove,
  busyFundId,
}: {
  fund: Fund;
  users: AppUser[];
  onOpenPicker: (fund: Fund) => void;
  onRemove: (fund: Fund, uid: string) => void;
  busyFundId: string | null;
}) {
  const supervisors = users.filter(
    (u) => u.role === 'fundManager' && (u.fundIds ?? []).includes(fund.id)
  );
  const busy = busyFundId === fund.id;

  return (
    <View style={styles.fundBlock}>
      <View style={styles.fundHeader}>
        <Text style={styles.fundName}>{fund.name}</Text>
        {fund.isGeneralFund && <Tag label="קרן כללית" tone="accent" />}
      </View>

      {supervisors.length === 0 ? (
        <Text style={styles.muted}>אין מפקחים על קרן זו — רק מנהל־על רואה אותה.</Text>
      ) : (
        <View style={styles.chipsRow}>
          {supervisors.map((u) => (
            <Chip
              key={u.uid}
              compact
              closeIcon="close"
              onClose={() => onRemove(fund, u.uid)}
              disabled={busy}
            >
              {u.fullName}
            </Chip>
          ))}
        </View>
      )}

      <Button
        mode="text"
        compact
        icon="account-plus"
        onPress={() => onOpenPicker(fund)}
        disabled={busy}
        loading={busy}
        style={styles.addButton}
      >
        הוספת מפקח
      </Button>
    </View>
  );
}

export default function Permissions() {
  const { users, loading } = useAllUsers();
  const { funds } = useFunds();
  const { firebaseUid } = useAuth();

  const [pickerFund, setPickerFund] = useState<Fund | null>(null);
  const [search, setSearch] = useState('');
  const [busyFundId, setBusyFundId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const superAdmins = users.filter((u) => u.role === 'superAdmin');

  // Anyone who isn't already supervising this fund and isn't a super admin
  // (they see everything regardless) is a candidate.
  const candidates = useMemo(() => {
    if (!pickerFund) return [];
    const term = normalizeName(search);
    return users
      .filter((u) => u.role !== 'superAdmin')
      .filter((u) => !(u.fundIds ?? []).includes(pickerFund.id))
      .filter((u) => !term || normalizeName(u.fullName).includes(term) || u.username.includes(search.trim()));
  }, [users, pickerFund, search]);

  const applySupervisors = async (fund: Fund, uids: string[]) => {
    setBusyFundId(fund.id);
    setError(null);
    try {
      await setFundSupervisors(fund.id, uids);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'העדכון נכשל');
    } finally {
      setBusyFundId(null);
    }
  };

  const currentSupervisorIds = (fund: Fund) =>
    users.filter((u) => (u.fundIds ?? []).includes(fund.id)).map((u) => u.uid);

  const onAdd = async (uid: string) => {
    if (!pickerFund) return;
    const next = [...currentSupervisorIds(pickerFund), uid];
    setPickerFund(null);
    setSearch('');
    await applySupervisors(pickerFund, next);
  };

  const onRemove = async (fund: Fund, uid: string) => {
    await applySupervisors(
      fund,
      currentSupervisorIds(fund).filter((id) => id !== uid)
    );
  };

  const onDemoteSuperAdmin = async (uid: string) => {
    setError(null);
    try {
      await setUserRole(uid, 'fundManager', []);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'העדכון נכשל');
    }
  };

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" />;
  }

  return (
    <>
      <Screen back title="ניהול הרשאות" subtitle="מי מנהל את הכל, ומי מפקח על איזו קרן">
        <Row>
          <Col flex={1}>
            <Panel title="מנהלי־על">
              <Text style={styles.sectionHint}>
                רואים ומנהלים את כל הקרנות. כל פעולת אישור שמורה להם בלבד.
              </Text>
              {superAdmins.map((u, index) => (
                <View key={u.uid}>
                  {index > 0 && <Divider style={styles.divider} />}
                  <View style={styles.adminRow}>
                    <View style={styles.adminIdentity}>
                      <Text style={styles.adminName}>{u.fullName}</Text>
                      <Text style={styles.muted}>
                        @{u.username}
                        {u.uid === firebaseUid ? ' · אתה' : ''}
                      </Text>
                    </View>
                    {u.uid !== firebaseUid && (
                      <Button mode="text" compact onPress={() => onDemoteSuperAdmin(u.uid)}>
                        הסרה
                      </Button>
                    )}
                  </View>
                </View>
              ))}
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            </Panel>
          </Col>

          <Col flex={1}>
            <Panel title="פיקוח לפי קרן">
              <Text style={styles.sectionHint}>
                לכל קרן, מי רשאי לצפות בה. מפקח רואה את הקרן שלו בלבד, ללא אפשרות לשנות דבר.
              </Text>
              {funds.length === 0 ? (
                <Text style={styles.muted}>עדיין לא נוצרו קרנות.</Text>
              ) : (
                funds.map((fund, i) => (
                  <View key={fund.id}>
                    {i > 0 && <Divider style={styles.divider} />}
                    <FundPermissionRow
                      fund={fund}
                      users={users}
                      onOpenPicker={(f) => {
                        setPickerFund(f);
                        setSearch('');
                      }}
                      onRemove={onRemove}
                      busyFundId={busyFundId}
                    />
                  </View>
                ))
              )}
            </Panel>
          </Col>
        </Row>
      </Screen>

      <Portal>
        <Modal
          visible={!!pickerFund}
          onDismiss={() => setPickerFund(null)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>מי יפקח על "{pickerFund?.name}"?</Text>
          <Searchbar
            placeholder="חיפוש לפי שם או שם משתמש"
            value={search}
            onChangeText={setSearch}
            style={styles.search}
            elevation={0}
          />
          <ScrollView style={styles.candidateList}>
            {candidates.length === 0 ? (
              <Text style={styles.muted}>
                {search ? 'לא נמצאו משתמשים מתאימים' : 'אין משתמשים זמינים להוספה'}
              </Text>
            ) : (
              candidates.map((u, i) => (
                <View key={u.uid}>
                  {i > 0 && <Divider style={styles.divider} />}
                  <Pressable onPress={() => onAdd(u.uid)}>
                    {({ pressed }) => (
                      <View style={[styles.candidateRow, pressed && styles.pressed]}>
                        <Text style={styles.adminName}>{u.fullName}</Text>
                        <Text style={styles.muted}>
                          {u.role === 'fundManager'
                            ? `@${u.username} · מנהל קרן`
                            : `@${u.username} · יקודם למנהל קרן`}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
          <Button onPress={() => setPickerFund(null)}>ביטול</Button>
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  divider: { backgroundColor: palette.line },
  sectionHint: { fontSize: 12, color: palette.inkFaint, lineHeight: 18, marginBottom: spacing.md },
  muted: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  fundBlock: { paddingVertical: spacing.sm },
  fundHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  fundName: { fontSize: 14, fontWeight: '600', color: palette.ink },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  adminIdentity: { flex: 1 },
  adminName: { fontSize: 14, fontWeight: '600', color: palette.ink },
  candidateRow: { paddingVertical: spacing.sm + 2 },
  pressed: { opacity: 0.6 },
  modal: {
    backgroundColor: palette.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    maxHeight: '80%',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: palette.ink, marginBottom: spacing.md },
  search: { backgroundColor: palette.page, marginBottom: spacing.md },
  candidateList: { maxHeight: 320 },
});
