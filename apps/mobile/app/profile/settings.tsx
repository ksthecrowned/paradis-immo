import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { applyThemePreference } from '@/lib/theme-preference';
import {
  obtainDevicePushToken,
  registerPushTokenWithApi,
  unregisterPushDeviceFromApi,
} from '@/lib/notifications';
import { getErrorMessage } from '@/lib/feedback';
import { fetchMe, updateMe } from '@/lib/users';
import {
  getUserPreferences,
  setUserPreferences,
  type ThemePreference,
  type UserPreferences,
} from '@/lib/user-preferences';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THEMES: Array<{ key: ThemePreference; label: string }> = [
  { key: 'system', label: 'Système' },
  { key: 'light', label: 'Clair' },
  { key: 'dark', label: 'Sombre' },
];

export default function ProfileSettingsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [applyingTheme, setApplyingTheme] = useState(false);
  const [updatingPush, setUpdatingPush] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/settings');
        if (!active) return;
        setReady(ok);
        if (ok) {
          setPrefs(await getUserPreferences());
          try {
            const user = await fetchMe();
            if (active) setPushEnabled(user.notificationChannel === 'PUSH');
          } catch (err) {
            showFeedback({
              type: 'error',
              title: 'Notifications',
              message: getErrorMessage(
                err,
                'Impossible de charger la préférence push depuis le serveur.',
              ),
            });
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [showFeedback]),
  );

  const update = async (patch: Partial<UserPreferences>): Promise<void> => {
    if (patch.theme != null) {
      setApplyingTheme(true);
      setPrefs((prev) => (prev ? { ...prev, theme: patch.theme! } : prev));
      try {
        await applyThemePreference(patch.theme);
      } catch {
        setApplyingTheme(false);
        showFeedback({
          type: 'error',
          title: 'Thème',
          message: 'Impossible d’appliquer le thème. Réessayez.',
        });
      }
      return;
    }

    const next = await setUserPreferences(patch);
    setPrefs(next);
  };

  const updatePush = async (enabled: boolean): Promise<void> => {
    if (updatingPush) return;
    setUpdatingPush(true);
    try {
      if (enabled) {
        const token = await obtainDevicePushToken();
        if (!token) {
          showFeedback({
            type: 'warning',
            title: 'Autorisation requise',
            message:
              'Les notifications push ne sont pas autorisées sur cet appareil. Autorisez-les dans les réglages puis réessayez.',
            buttons: [
              { text: 'Plus tard', style: 'cancel' },
              {
                text: 'Ouvrir les réglages',
                onPress: () => void Linking.openSettings(),
              },
            ],
          });
          return;
        }
        await updateMe({ notificationChannel: 'PUSH' });
        try {
          await registerPushTokenWithApi();
        } catch (err) {
          await updateMe({ notificationChannel: 'WHATSAPP' });
          throw err;
        }
        setPushEnabled(true);
      } else {
        await updateMe({ notificationChannel: 'WHATSAPP' });
        setPushEnabled(false);
        try {
          await unregisterPushDeviceFromApi({ strict: true });
        } catch {
          showFeedback({
            type: 'warning',
            title: 'Push désactivées',
            message:
              'La préférence serveur est désactivée, mais cet appareil n’a pas pu être retiré. Réessayez quand le réseau sera disponible.',
          });
          return;
        }
      }
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Préférence non enregistrée',
        message: getErrorMessage(
          err,
          'Impossible de modifier les notifications push.',
        ),
      });
    } finally {
      setUpdatingPush(false);
    }
  };

  if (!ready || !prefs) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Réglages" icon="settings-outline" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Langue</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Français</Text>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
          </View>
          <View style={[styles.row, styles.rowDisabled]}>
            <View>
              <Text style={[styles.rowLabel, styles.disabledText]}>English</Text>
              <Text style={styles.soon}>Bientôt</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thème</Text>
        <View style={styles.card}>
          {THEMES.map((theme) => {
            const active = prefs.theme === theme.key;
            return (
              <Pressable
                key={theme.key}
                style={styles.row}
                onPress={() => void update({ theme: theme.key })}
                disabled={applyingTheme}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.rowLabel}>{theme.label}</Text>
                {applyingTheme && active ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : active ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Notifications push</Text>
            <Switch
              value={pushEnabled}
              onValueChange={(value) => void updatePush(value)}
              disabled={updatingPush}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onPrimary}
            />
          </View>
          <Text style={styles.pushHint}>
            {updatingPush
              ? 'Mise à jour…'
              : 'Les notifications dans l’application restent disponibles.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  disabledText: {
    color: colors.muted,
  },
  soon: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  pushHint: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    fontSize: 12,
    color: colors.muted,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
