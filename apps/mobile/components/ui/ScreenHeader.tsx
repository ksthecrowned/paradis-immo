import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Trailing Ionicons name — renders a soft icon badge on the right. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom trailing node; overrides `icon` when provided. */
  trailing?: React.ReactNode;
  onBack?: () => void;
  /** When false, keeps layout balance without a back control (e.g. tab roots). */
  showBack?: boolean;
  backAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Top bar: back · centered title/subtitle · optional trailing icon.
 */
export function ScreenHeader({
  title,
  subtitle,
  icon,
  trailing,
  onBack,
  showBack = true,
  backAccessibilityLabel = 'Retour',
  style,
}: ScreenHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const trailingNode =
    trailing ??
    (icon ? (
      <View style={styles.iconBadge}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
    ) : (
      <View style={styles.spacer} />
    ));

  return (
    <View
      style={[styles.topBar, { paddingTop: insets.top + spacing.sm }, style]}
    >
      {showBack ? (
        <CircleIconButton
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel={backAccessibilityLabel}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailingNode}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
  },
  iconBadge: {
    width: 50,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 50,
    height: 50,
  },
});
