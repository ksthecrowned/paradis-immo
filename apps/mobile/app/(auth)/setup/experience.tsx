import { SetupOptionCard } from '@/components/setup/SetupOptionCard';
import { SetupShell } from '@/components/setup/SetupShell';
import { useSeekerSetup } from '@/context/SeekerSetupContext';
import { spacing } from '@/constants/theme';
import type { SeekerExperience } from '@/lib/seeker-setup';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

const OPTIONS: Array<{
  value: SeekerExperience;
  label: string;
  icon: 'sparkles-outline' | 'search-outline' | 'ribbon-outline';
}> = [
  {
    value: 'FIRST_TIME',
    label: 'Première fois',
    icon: 'sparkles-outline',
  },
  {
    value: 'RETURNING',
    label: 'Déjà cherché',
    icon: 'search-outline',
  },
  {
    value: 'PRO',
    label: 'Je m’y connais',
    icon: 'ribbon-outline',
  },
];

export default function SetupExperienceScreen(): React.JSX.Element {
  const { draft, setExperience } = useSeekerSetup();

  const goNext = (): void => {
    router.push('/(auth)/setup/budget');
  };

  return (
    <SetupShell
      stepIndex={1}
      title="Où en êtes-vous dans votre recherche ?"
      canContinue={draft.experience != null}
      onSkip={() => {
        setExperience(null);
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
            selected={draft.experience === opt.value}
            onPress={() => setExperience(opt.value)}
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
