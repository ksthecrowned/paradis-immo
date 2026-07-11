import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function SuccessScreen({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
        onPress={onPrimary}
        accessibilityRole="button"
        accessibilityLabel={primaryLabel}
      >
        <Text style={styles.primaryText}>{primaryLabel}</Text>
      </Pressable>
      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={onSecondary}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          hitSlop={8}
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  primary: {
    alignSelf: 'stretch',
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    backgroundColor: colors.primaryHover,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  secondaryText: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
