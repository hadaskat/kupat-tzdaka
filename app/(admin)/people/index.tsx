import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, ActivityIndicator, Button, Searchbar, SegmentedButtons, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSearchPeople, usePeople, type PeopleFilter } from '../../../src/api/people';
import { formatCurrency } from '../../../src/utils/format';
import { Screen, Row } from '../../../src/components/layout/Screen';
import { StatCard, Panel } from '../../../src/components/layout/StatCard';
import { palette, spacing } from '../../../src/theme';

const filterOptions: { value: PeopleFilter; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'donors', label: 'תורמים' },
  { value: 'beneficiaries', label: 'נתמכים' },
];

export default function PeopleList() {
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const { people: results, loading } = useSearchPeople(term, filter);
  const { people: all } = usePeople();
  const router = useRouter();

  const donors = all.filter((p) => p.isDonor).length;
  const beneficiaries = all.filter((p) => p.isBeneficiary).length;
  const totalDonated = all.reduce((s, p) => s + (p.totalDonated || 0), 0);

  return (
    <Screen
      title="כרטסת"
      subtitle="תורמים ונתמכים — כרטיס אחד לכל אדם"
      action={
        <Button mode="contained" icon="plus" onPress={() => router.push('/people/new')}>
          רשומה חדשה
        </Button>
      }
    >
      <Row>
        <StatCard label="סה״כ רשומות" value={all.length} tone="accent" />
        <StatCard label="תורמים" value={donors} />
        <StatCard label="נתמכים" value={beneficiaries} />
        <StatCard label="סך התרומות" value={formatCurrency(totalDonated)} tone="in" />
      </Row>

      <View style={styles.gap} />

      <Panel>
        <Searchbar
          placeholder="חיפוש לפי שם, טלפון או ת.ז"
          value={term}
          onChangeText={setTerm}
          style={styles.search}
          elevation={0}
        />
        <SegmentedButtons
          value={filter}
          onValueChange={(v) => setFilter(v as PeopleFilter)}
          buttons={filterOptions}
          style={styles.filter}
        />

        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : results.length === 0 ? (
          <Text style={styles.empty}>{term ? 'לא נמצאו תוצאות' : 'אין עדיין רשומות בכרטסת'}</Text>
        ) : (
          results.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider style={styles.divider} />}
              <Pressable onPress={() => router.push(`/people/${p.id}`)}>
                {({ pressed }) => (
                  <View style={[styles.row, pressed && styles.pressed]}>
                    <View style={styles.rowMain}>
                      <Text style={styles.name}>{p.fullName}</Text>
                      <View style={styles.metaRow}>
                        {!!p.phone && <Text style={styles.meta}>{p.phone}</Text>}
                        {p.isDonor && <Text style={styles.roleTag}>תורם</Text>}
                        {p.isBeneficiary && <Text style={styles.roleTag}>נתמך</Text>}
                      </View>
                    </View>
                    <View style={styles.amounts}>
                      {p.totalDonated > 0 && (
                        <Text style={styles.donated}>תרם {formatCurrency(p.totalDonated)}</Text>
                      )}
                      {p.totalReceived > 0 && (
                        <Text style={styles.received}>קיבל {formatCurrency(p.totalReceived)}</Text>
                      )}
                    </View>
                  </View>
                )}
              </Pressable>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: spacing.md },
  search: { backgroundColor: palette.page, marginBottom: spacing.sm },
  filter: { marginBottom: spacing.md },
  loader: { marginVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
  },
  rowMain: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: palette.ink },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 3, alignItems: 'center' },
  meta: { fontSize: 12, color: palette.inkFaint },
  roleTag: { fontSize: 11, color: palette.accentDark, backgroundColor: palette.accentSoft, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  amounts: { alignItems: 'flex-end' },
  donated: { fontSize: 13, color: palette.moneyIn, fontWeight: '600' },
  received: { fontSize: 13, color: palette.moneyOut, fontWeight: '600', marginTop: 2 },
  pressed: { opacity: 0.6 },
  divider: { backgroundColor: palette.line },
  empty: { color: palette.inkFaint, fontSize: 13, paddingVertical: spacing.lg, textAlign: 'center' },
});
