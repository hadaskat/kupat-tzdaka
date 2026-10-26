import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import type { ReactNode } from 'react';
import { palette, spacing, card } from '../../theme';

export type StatTone = 'neutral' | 'in' | 'out' | 'accent';

const TONE_COLOR: Record<StatTone, string> = {
  neutral: palette.neutralFigure,
  in: palette.moneyIn,
  out: palette.moneyOut,
  accent: palette.accent,
};

interface StatCardProps {
  label: string;
  value: string | number;
  caption?: string;
  tone?: StatTone;
  onPress?: () => void;
}

/**
 * A compact figure tile. Deliberately small: several sit side by side, so the
 * dashboard reads as a summary rather than one oversized number.
 */
export function StatCard({ label, value, caption, tone = 'neutral', onPress }: StatCardProps) {
  const body = (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: TONE_COLOR[tone] }]}>{value}</Text>
      {!!caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{body}</View>}
    </Pressable>
  );
}

/** White card with a title row, for lists and grouped content. */
export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.panel}>
      {(!!title || !!action) && (
        <View style={styles.panelHeader}>
          {!!title && <Text style={styles.panelTitle}>{title}</Text>}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    ...card,
    padding: spacing.md,
    flex: 1,
    minHeight: 108,
    justifyContent: 'center',
  },
  label: { fontSize: 13, color: palette.inkMuted },
  value: { fontSize: 26, fontWeight: '700', marginTop: spacing.xs },
  caption: { fontSize: 12, color: palette.inkFaint, marginTop: spacing.xs },

  panel: { ...card, padding: spacing.md },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  panelTitle: { fontSize: 15, fontWeight: '700', color: palette.ink },
});
