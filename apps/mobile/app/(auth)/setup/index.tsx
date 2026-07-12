import { SetupOptionCard } from '@/components/setup/SetupOptionCard';
import { SetupPermissionPanel } from '@/components/setup/SetupPermissionPanel';
import { SetupShell } from '@/components/setup/SetupShell';
import {
  SETUP_STEP_META,
  useSeekerSetup,
} from '@/context/SeekerSetupContext';
import { useUserLocation } from '@/context/LocationContext';
import { useFeedback } from '@/context/FeedbackContext';
import { spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/feedback';
import { registerPushTokenWithApi } from '@/lib/notifications';
import {
  type SeekerExperience,
  type SeekerIntent,
} from '@/lib/seeker-setup';
import { persistSeekerSetupAndSync } from '@/lib/seeker-setup-persist';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const INTENT_OPTIONS: Array<{
  value: SeekerIntent;
  label: string;
  icon: 'home-outline' | 'key-outline' | 'eye-outline' | 'options-outline';
}> = [
  { value: 'RENT', label: 'Louer', icon: 'home-outline' },
  { value: 'BUY', label: 'Acheter', icon: 'key-outline' },
  { value: 'VISIT', label: 'Juste visiter', icon: 'eye-outline' },
  { value: 'ALL_OPTIONS', label: 'Toutes les options', icon: 'options-outline' },
];

const EXPERIENCE_OPTIONS: Array<{
  value: SeekerExperience;
  label: string;
  icon: 'sparkles-outline' | 'search-outline' | 'ribbon-outline';
}> = [
  { value: 'FIRST_TIME', label: 'Première fois', icon: 'sparkles-outline' },
  { value: 'RETURNING', label: 'Déjà cherché', icon: 'search-outline' },
  { value: 'PRO', label: 'Je m’y connais', icon: 'ribbon-outline' },
];

type PermissionStatus = 'idle' | 'granted' | 'denied';

export default function SetupWizardScreen(): React.JSX.Element {
  const {
    draft,
    stepIndex,
    isLastStep,
    setIntent,
    setExperience,
    nextStep,
  } = useSeekerSetup();
  const { refresh: refreshLocation, denied: locationDenied, coords } =
    useUserLocation();
  const { showFeedback } = useFeedback();
  const meta = SETUP_STEP_META[stepIndex];

  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [locationStatus, setLocationStatus] =
    useState<PermissionStatus>('idle');
  const [notificationStatus, setNotificationStatus] =
    useState<PermissionStatus>('idle');

  const busy = saving || requesting;

  const canContinue = useMemo(() => {
    if (busy) return false;
    if (stepIndex === 0) return draft.intent != null;
    if (stepIndex === 1) return draft.experience != null;
    return true;
  }, [stepIndex, draft, busy]);

  const finish = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      await persistSeekerSetupAndSync(draft);
      router.replace('/(auth)/personnal-infos');
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Préférences',
        message: getErrorMessage(
          err,
          'Impossible d’enregistrer vos préférences',
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const requestLocation = async (): Promise<void> => {
    setRequesting(true);
    try {
      const next = await refreshLocation();
      setLocationStatus(next ? 'granted' : 'denied');
    } finally {
      setRequesting(false);
    }
  };

  const requestNotifications = async (): Promise<void> => {
    setRequesting(true);
    try {
      const token = await registerPushTokenWithApi();
      setNotificationStatus(token ? 'granted' : 'denied');
    } catch {
      setNotificationStatus('denied');
    } finally {
      setRequesting(false);
    }
  };

  const onSkip = (): void => {
    if (busy) return;
    if (stepIndex === 0) setIntent(null);
    if (stepIndex === 1) setExperience(null);
    if (isLastStep) {
      void finish();
      return;
    }
    nextStep();
  };

  const onContinue = (): void => {
    if (busy) return;

    if (stepIndex === 2) {
      void (async () => {
        await requestLocation();
        nextStep();
      })();
      return;
    }

    if (isLastStep) {
      void (async () => {
        await requestNotifications();
        await finish();
      })();
      return;
    }

    nextStep();
  };

  const resolvedLocationStatus: PermissionStatus =
    locationStatus !== 'idle'
      ? locationStatus
      : coords
        ? 'granted'
        : locationDenied
          ? 'denied'
          : 'idle';

  const continueLabel =
    stepIndex === 2
      ? 'Autoriser la localisation'
      : stepIndex === 3
        ? 'Autoriser les notifications'
        : 'Continuer';

  return (
    <SetupShell
      title={meta.title}
      subtitle={meta.subtitle}
      canContinue={canContinue}
      continuing={busy}
      continueLabel={continueLabel}
      onSkip={onSkip}
      onContinue={onContinue}
    >
      {stepIndex === 0 ? (
        <View style={styles.grid}>
          {INTENT_OPTIONS.map((opt) => (
            <SetupOptionCard
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              selected={draft.intent === opt.value}
              onPress={() => setIntent(opt.value)}
            />
          ))}
        </View>
      ) : null}

      {stepIndex === 1 ? (
        <View style={styles.grid}>
          {EXPERIENCE_OPTIONS.map((opt) => (
            <SetupOptionCard
              key={opt.value}
              label={opt.label}
              icon={opt.icon}
              selected={draft.experience === opt.value}
              onPress={() => setExperience(opt.value)}
            />
          ))}
        </View>
      ) : null}

      {stepIndex === 2 ? (
        <SetupPermissionPanel
          icon="location-outline"
          heading="Biens autour de vous"
          body="Paradis Immo utilise votre position uniquement pour la recherche et la carte. Vous pouvez refuser et continuer."
          status={resolvedLocationStatus}
        />
      ) : null}

      {stepIndex === 3 ? (
        <SetupPermissionPanel
          icon="notifications-outline"
          heading="Restez informé"
          body="Activez les notifications pour les confirmations de visite, reçus de paiement et rappels utiles."
          status={notificationStatus}
        />
      ) : null}
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
