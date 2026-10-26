import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { palette, spacing } from '../../theme';

interface MenuRowProps {
  icon: string;
  title: string;
  description?: string;
  onPress: () => void;
}

/** A navigation row inside a Panel - the replacement for Paper's List.Item. */
export function MenuRow({ icon, title, description, onPress }: MenuRowProps) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.pressed]}>
          <View style={styles.iconBox}>
            <Icon source={icon} size={20} color={palette.accent} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            {!!description && <Text style={styles.description}>{description}</Text>}
          </View>
          {/* chevron-left: the document is dir="rtl", so "forward" points left. */}
          <Icon source="chevron-left" size={20} color={palette.inkFaint} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: palette.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: palette.ink },
  description: { fontSize: 12, color: palette.inkFaint, marginTop: 2 },
  pressed: { opacity: 0.6 },
});
