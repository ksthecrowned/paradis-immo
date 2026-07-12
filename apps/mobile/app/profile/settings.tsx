import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { applyThemePreference } from '@/lib/theme-preference';
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
  const [applyingTheme, setApplyingTheme] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/settings');
        if (!active) return;
        setReady(ok);
        if (ok) {
          setPrefs(await getUserPreferences());
        }
      })();
      return () => {
        active = false;
      };
    }, []),
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
    showFeedback({
      type: 'info',
      title: 'Préférence enregistrée',
      message: 'Vos réglages ont été mis à jour sur cet appareil.',
    });
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
              value={prefs.pushEnabled}
              onValueChange={(value) => void update({ pushEnabled: value })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.onPrimary}
            />
          </View>
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
});
