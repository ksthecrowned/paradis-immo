import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type MenuItem = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  labelColor?: string;
  disabled?: boolean;
  onPress: () => void;
};

type MenuSectionProps = {
  title: string;
  items: MenuItem[];
};

export function MenuSection({
  title,
  items,
}: MenuSectionProps): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.id}>
            <Pressable
              style={({ pressed }) => [
                styles.row,
                item.disabled && styles.rowDisabled,
                pressed && !item.disabled && styles.rowPressed,
              ]}
              onPress={item.onPress}
              disabled={item.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(item.disabled) }}
              accessibilityLabel={item.label}
            >
              <View
                style={[
                  styles.iconWrap,
                  item.id === "logout" && { backgroundColor: colors.danger + "20" }
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.iconColor ?? colors.primary}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  item.labelColor ? { color: item.labelColor } : null,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.muted}
              />
            </Pressable>
            {index < items.length - 1 ? (
              <View style={styles.divider} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.primaryMuted,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 66,
  },
});
