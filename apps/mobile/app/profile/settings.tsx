import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
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
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Réglages</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
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
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={styles.rowLabel}>{theme.label}</Text>
                {active ? (
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
              thumbColor={colors.surface}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 44 },
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
