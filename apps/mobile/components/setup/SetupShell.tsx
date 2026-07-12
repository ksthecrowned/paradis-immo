import { colors, radii, spacing } from '@/constants/theme';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEP_COUNT = 4;

export type SetupShellProps = {
  stepIndex: 0 | 1 | 2 | 3;
  title: string;
  subtitle?: string;
  canContinue: boolean;
  continuing?: boolean;
  onSkip: () => void;
  onContinue: () => void;
  children: ReactNode;
};

export function SetupShell({
  stepIndex,
  title,
  subtitle,
  canContinue,
  continuing = false,
  onSkip,
  onContinue,
  children,
}: SetupShellProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <View style={styles.progressRow}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                i <= stepIndex && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={onSkip}
          disabled={continuing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Passer"
        >
          <Text style={styles.skip}>Passer</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            (!canContinue || continuing) && styles.ctaDisabled,
            pressed && canContinue && !continuing && styles.ctaPressed,
          ]}
          disabled={!canContinue || continuing}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continuer"
        >
          {continuing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.ctaText}>Continuer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  progressSegmentActive: {
    backgroundColor: colors.primary,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  cta: {
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
