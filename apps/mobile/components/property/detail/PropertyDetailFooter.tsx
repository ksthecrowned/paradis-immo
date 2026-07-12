import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  showCta: boolean;
  ctaAnim: Animated.Value;
  available: boolean;
  ctaLabel: string;
  blockedTitle: string;
  statusBadge: string | null;
  onCtaPress: () => void;
  onOpenActions: () => void;
};

export function PropertyDetailFooter({
  showCta,
  ctaAnim,
  available,
  ctaLabel,
  blockedTitle,
  statusBadge,
  onCtaPress,
  onOpenActions,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      pointerEvents={showCta ? 'auto' : 'none'}
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, 16),
          opacity: ctaAnim,
          transform: [
            {
              translateY: ctaAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [72, 0],
              }),
            },
          ],
        },
      ]}
    >
      {available ? (
        <Pressable
          style={({ pressed }) => [
            styles.ctaPrimary,
            pressed && styles.ctaPrimaryPressed,
          ]}
          onPress={onCtaPress}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.unavailableBanner}>
          <Text style={styles.unavailableTitle}>{blockedTitle}</Text>
          {statusBadge ? (
            <Text style={styles.unavailableReason}>{statusBadge}</Text>
          ) : null}
        </View>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.ctaSecondary,
          pressed && styles.ctaSecondaryPressed,
        ]}
        onPress={onOpenActions}
        accessibilityRole="button"
        accessibilityLabel="Actions supplémentaires"
      >
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.onPrimary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: 10,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaPrimary: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaPrimaryPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  unavailableBanner: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.lg,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 2,
  },
  unavailableTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.danger,
  },
  unavailableReason: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  ctaSecondary: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaSecondaryPressed: {
    opacity: 0.85,
  },
});
