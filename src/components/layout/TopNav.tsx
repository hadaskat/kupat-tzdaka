import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { palette, spacing, CONTENT_MAX_WIDTH } from '../../theme';

export interface NavItem {
  label: string;
  href: string;
  /** Extra path prefixes that should also light this item up. */
  match?: string[];
  badge?: number;
}

/**
 * Desktop-style top navigation. On web a bottom tab bar reads as a phone UI,
 * so wide screens get this instead and the tab bar is hidden.
 */
export function TopNav({ items, brand }: { items: NavItem[]; brand: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    pathname === item.href || (item.match ?? []).some((p) => pathname.startsWith(p));

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="hand-heart" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.brand}>{brand}</Text>
        </View>

        <View style={styles.links}>
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Pressable key={item.href} onPress={() => router.push(item.href as never)}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.link,
                      active && styles.linkActive,
                      pressed && !active && styles.linkPressed,
                    ]}
                  >
                    <Text style={[styles.linkText, active && styles.linkTextActive]}>
                      {item.label}
                    </Text>
                    {!!item.badge && item.badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  inner: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    // Grouped from the start edge (the right, in RTL) rather than pushed to
    // opposite ends, so the brand and its links read as one unit.
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    gap: spacing.lg,
  },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 16, fontWeight: '700', color: palette.ink },

  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  linkActive: { backgroundColor: palette.accentSoft },
  linkPressed: { backgroundColor: palette.page },
  linkText: { fontSize: 14, color: palette.inkMuted, fontWeight: '500' },
  linkTextActive: { color: palette.accentDark, fontWeight: '600' },

  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: palette.moneyOut,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
