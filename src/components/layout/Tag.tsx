import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { palette } from '../../theme';

export type TagTone = 'neutral' | 'accent' | 'in' | 'out' | 'warn';

const TONES: Record<TagTone, { bg: string; fg: string }> = {
  neutral: { bg: palette.page, fg: palette.inkMuted },
  accent: { bg: palette.accentSoft, fg: palette.accentDark },
  in: { bg: '#DCFCE7', fg: '#166534' },
  out: { bg: '#FEE2E2', fg: '#991B1B' },
  warn: { bg: '#FEF3C7', fg: '#92400E' },
};

/** Small inline status pill. Deliberately quieter than a Paper Chip. */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: TagTone }) {
  const { bg, fg } = TONES[tone];
  return <Text style={[styles.tag, { backgroundColor: bg, color: fg }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  tag: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
});
