import { CircleIconButton } from '@/components/ui/CircleIconButton';
import {
  SETUP_STEP_COUNT,
  useSeekerSetup,
  type SetupStepIndex,
} from '@/context/SeekerSetupContext';
import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
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

export type SetupShellProps = {
  title: string;
  subtitle?: string;
  canContinue: boolean;
  continuing?: boolean;
  continueLabel?: string;
  onSkip: () => void;
  onContinue: () => void;
  children: ReactNode;
};

export function SetupShell({
  title,
  subtitle,
  canContinue,
  continuing = false,
  continueLabel = 'Continuer',
  onSkip,
  onContinue,
  children,
}: SetupShellProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { stepIndex, goToStep, prevStep, isFirstStep } = useSeekerSetup();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        {!isFirstStep ? (
          <CircleIconButton
            onPress={prevStep}
            accessibilityLabel="Étape précédente"
            disabled={continuing}
          >
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </CircleIconButton>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <View style={styles.progressRow}>
          {Array.from({ length: SETUP_STEP_COUNT }, (_, i) => {
            const index = i as SetupStepIndex;
            const active = index <= stepIndex;
            const current = index === stepIndex;
            return (
              <Pressable
                key={index}
                onPress={() => goToStep(index)}
                disabled={continuing}
                style={[
                  styles.progressSegment,
                  active && styles.progressSegmentActive,
                  current && styles.progressSegmentCurrent,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Aller à l’étape ${index + 1}`}
                accessibilityState={{ selected: current }}
                hitSlop={6}
              />
            );
          })}
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
            <Text style={styles.ctaText}>{continueLabel}</Text>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  backSpacer: {
    width: 54,
    height: 54,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  progressSegmentActive: {
    backgroundColor: colors.primarySoft,
  },
  progressSegmentCurrent: {
    backgroundColor: colors.primary,
  },
  skip: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
    minWidth: 56,
    textAlign: 'right',
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
