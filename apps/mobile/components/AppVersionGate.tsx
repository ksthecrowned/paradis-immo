import { colors, radii, spacing } from '@/constants/theme';
import {
  fetchMobileAppConfig,
  type PlatformVersionPolicy,
} from '@/lib/platform-config';
import { compareSemanticVersions } from '@/lib/semantic-version';
import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function validStoreUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function AppVersionGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [policy, setPolicy] = useState<PlatformVersionPolicy | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const requestSequence = useRef(0);
  const installedVersion = Constants.expoConfig?.version ?? null;

  const refreshPolicy = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setIsChecking(true);
    try {
      const config = await fetchMobileAppConfig();
      if (sequence !== requestSequence.current) return;
      setPolicyError(false);
      const nextPolicy = config.versions?.[Platform.OS as 'ios' | 'android'];
      if (!nextPolicy || !installedVersion) {
        setPolicy(null);
        setUpdateRequired(false);
        return;
      }
      const comparison = compareSemanticVersions(
        installedVersion,
        nextPolicy.minVersion,
      );
      setPolicy(nextPolicy);
      setUpdateRequired(comparison !== null && comparison < 0);
    } catch {
      if (sequence !== requestSequence.current) return;
      // Keep the last enforced policy; transient outages must not clear a block.
      setPolicyError(true);
    } finally {
      if (sequence === requestSequence.current) setIsChecking(false);
    }
  }, [installedVersion]);

  useEffect(() => {
    void refreshPolicy();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPolicy();
    });
    return () => {
      requestSequence.current += 1;
      subscription.remove();
    };
  }, [refreshPolicy]);

  const openStore = async (): Promise<void> => {
    const url = validStoreUrl(policy?.storeUrl ?? null);
    if (!url) {
      setStoreError('Le lien de mise à jour n’est pas encore disponible.');
      return;
    }
    try {
      await Linking.openURL(url);
      setStoreError(null);
    } catch {
      setStoreError('Impossible d’ouvrir la boutique d’applications.');
    }
  };

  if (!updateRequired || !policy) return <>{children}</>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>!</Text>
        </View>
        <Text style={styles.title}>Mise à jour requise</Text>
        <Text style={styles.body}>
          {policy.message?.trim() ||
            'Une nouvelle version de Paradis Immo est nécessaire pour continuer.'}
        </Text>
        <Text style={styles.version}>
          Version installée : {installedVersion} · Version minimale :{' '}
          {policy.minVersion}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void openStore()}
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.buttonText}>Mettre à jour</Text>
        </Pressable>
        {storeError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {storeError}
          </Text>
        ) : null}
        {policyError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Impossible d’actualiser la politique de mise à jour. Réessayez.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={isChecking}
          onPress={() => void refreshPolicy()}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && !isChecking ? styles.buttonPressed : null,
          ]}
        >
          <Text style={styles.retryButtonText}>
            {isChecking ? 'Vérification…' : 'Réessayer'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  iconText: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  version: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  retryButtonText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
});
