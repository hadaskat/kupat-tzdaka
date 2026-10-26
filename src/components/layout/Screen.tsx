import type { ReactNode } from 'react';
import { ScrollView, View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { palette, spacing, CONTENT_MAX_WIDTH, WIDE_BREAKPOINT } from '../../theme';

export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

interface ScreenProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered at the far side of the title row - usually a primary action. */
  action?: ReactNode;
  scroll?: boolean;
  /** Forms read badly at full width - `narrow` keeps them to a single column. */
  narrow?: boolean;
  /**
   * Draws an in-page back link. Wide screens hide the navigator header (it
   * duplicates the top nav and the screen title), so sub-screens need their own
   * way back; narrow screens still have the header, so this stays hidden there.
   */
  back?: boolean;
}

/**
 * Every screen sits in the same centred column with the same page padding, so
 * content never stretches the full width of a monitor.
 */
export function Screen({
  title,
  subtitle,
  action,
  children,
  scroll = true,
  narrow = false,
  back = false,
}: ScreenProps) {
  const isWide = useIsWide();
  const router = useRouter();

  const body = (
    <View style={[styles.container, { paddingHorizontal: isWide ? spacing.xl : spacing.md }]}>
      <View style={[styles.inner, narrow && styles.innerNarrow]}>
        {back && isWide && (
          <Pressable onPress={() => router.back()} style={styles.back}>
            {({ pressed }) => (
              <View style={[styles.backInner, pressed && styles.backPressed]}>
                {/* arrow-right: the document is dir="rtl", so "back" points right. */}
                <Icon source="arrow-right" size={16} color={palette.inkMuted} />
                <Text style={styles.backText}>חזרה</Text>
              </View>
            )}
          </Pressable>
        )}
        {!!title && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {action}
          </View>
        )}
        {children}
      </View>
    </View>
  );

  if (!scroll) return <View style={styles.page}>{body}</View>;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
      {body}
    </ScrollView>
  );
}

/** A row that becomes a column on narrow screens. */
export function Row({ children, gap = spacing.md }: { children: ReactNode; gap?: number }) {
  const isWide = useIsWide();
  return (
    <View style={[styles.row, { flexDirection: isWide ? 'row' : 'column', gap }]}>{children}</View>
  );
}

export function Col({ children, flex = 1 }: { children: ReactNode; flex?: number }) {
  const isWide = useIsWide();
  return <View style={isWide ? { flex } : undefined}>{children}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.page },
  scrollContent: { paddingBottom: spacing.xl },
  container: { paddingVertical: spacing.lg, alignItems: 'center' },
  inner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  innerNarrow: { maxWidth: 620 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  back: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  backInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backPressed: { opacity: 0.6 },
  backText: { fontSize: 13, color: palette.inkMuted },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: palette.ink },
  subtitle: { fontSize: 13, color: palette.inkFaint, marginTop: 2 },
  row: { width: '100%' },
});
