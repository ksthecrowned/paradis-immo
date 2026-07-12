import { SetupOptionCard } from '@/components/setup/SetupOptionCard';
import { SetupShell } from '@/components/setup/SetupShell';
import { useSeekerSetup } from '@/context/SeekerSetupContext';
import { spacing } from '@/constants/theme';
import type { SeekerIntent } from '@/lib/seeker-setup';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const OPTIONS: Array<{
  value: SeekerIntent;
  label: string;
  icon: 'home-outline' | 'key-outline' | 'options-outline';
}> = [
  { value: 'RENT', label: 'Louer', icon: 'home-outline' },
  { value: 'BUY', label: 'Acheter', icon: 'key-outline' },
  { value: 'BOTH', label: 'Les deux', icon: 'options-outline' },
];

export default function SetupIntentScreen(): React.JSX.Element {
  const { draft, setIntent } = useSeekerSetup();

  const goNext = (): void => {
    router.push('/(auth)/setup/experience');
  };

  return (
    <SetupShell
      stepIndex={0}
      title="Quel est votre objectif ?"
      canContinue={draft.intent != null}
      onSkip={() => {
        setIntent(null);
        goNext();
      }}
      onContinue={goNext}
    >
      <View style={styles.grid}>
        {OPTIONS.map((opt) => (
          <SetupOptionCard
            key={opt.value}
            label={opt.label}
            icon={opt.icon}
            selected={draft.intent === opt.value}
            onPress={() => setIntent(opt.value)}
          />
        ))}
      </View>
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
