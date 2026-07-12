import { SetupShell } from '@/components/setup/SetupShell';
import { useSeekerSetup } from '@/context/SeekerSetupContext';
import { colors, radii, spacing } from '@/constants/theme';
import { budgetBandsForIntent } from '@/lib/seeker-setup';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function SetupBudgetScreen(): React.JSX.Element {
  const { draft, setBudget } = useSeekerSetup();
  const bands = budgetBandsForIntent(draft.intent);

  const selectedId = bands.find(
    (b) =>
      b.min === draft.budgetMinXaf &&
      (b.max === draft.budgetMaxXaf ||
        (b.max == null && draft.budgetMaxXaf == null)),
  )?.id;

  const goNext = (): void => {
    router.push('/(auth)/setup/neighborhoods');
  };

  return (
    <SetupShell
      stepIndex={2}
      title="Quel budget visez-vous ?"
      subtitle="Montants en FCFA"
      canContinue={draft.budgetMinXaf != null}
      onSkip={() => {
        setBudget(null, null);
        goNext();
      }}
      onContinue={goNext}
    >
      <View style={styles.list}>
        {bands.map((band) => {
          const selected = selectedId === band.id;
          return (
            <Pressable
              key={band.id}
              onPress={() => setBudget(band.min, band.max)}
              style={[styles.row, selected && styles.rowSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>
                {band.label}
              </Text>
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </Pressable>
          );
        })}
      </View>
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  labelSelected: {
    color: colors.primary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
});
