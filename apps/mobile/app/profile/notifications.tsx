import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  getPushNotificationPreferences,
  updatePushNotificationPreference,
  type NotificationCategory,
  type PushNotificationPreference,
} from '@/lib/notification-preferences';
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

const CATEGORIES: Array<{
  key: NotificationCategory;
  label: string;
}> = [
  { key: 'PAYMENTS', label: 'Paiements et loyers' },
  { key: 'VISITS', label: 'Visites' },
  { key: 'STAYS', label: 'Séjours' },
  { key: 'SALES', label: 'Ventes' },
  { key: 'MAINTENANCE', label: 'Maintenance' },
  { key: 'MESSAGES', label: 'Messages' },
  { key: 'MANDATES', label: 'Mandats et approbations' },
  { key: 'LEASES', label: 'Locations et baux' },
  { key: 'ACCOUNT', label: 'Compte et sécurité' },
  { key: 'MARKETING', label: 'Marketing et alertes de recherche' },
];

export default function NotificationPreferencesScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<
    PushNotificationPreference[] | null
  >(null);
  const [pendingCategory, setPendingCategory] =
    useState<NotificationCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPreferences(await getPushNotificationPreferences());
    } catch (err) {
      setError(
        getErrorMessage(err, 'Impossible de charger vos préférences push.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/notifications');
        if (!active || !ok) return;
        setLoading(true);
        await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const update = async (
    category: NotificationCategory,
    push: boolean,
  ): Promise<void> => {
    if (pendingCategory) return;
    setPendingCategory(category);
    setError(null);
    try {
      setPreferences(
        await updatePushNotificationPreference({ category, push }),
      );
    } catch (err) {
      setError(
        getErrorMessage(err, 'La préférence n’a pas été modifiée. Réessayez.'),
      );
    } finally {
      setPendingCategory(null);
    }
  };

  if (loading && !preferences) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Préférences push" icon="notifications-outline" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Text style={styles.intro}>
          Choisissez les catégories qui peuvent vous envoyer des notifications
          push sur cet appareil. Les notifications dans l’application restent
          disponibles. Les alertes critiques de sécurité ou de paiement ne
          peuvent pas être désactivées.
        </Text>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()} accessibilityRole="button">
              <Text style={styles.retry}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}
        {preferences ? (
          <View style={styles.card}>
            {CATEGORIES.map(({ key, label }, index) => {
              const preference = preferences.find(
                (item) => item.category === key,
              );
              return (
                <View
                  key={key}
                  style={[
                    styles.row,
                    index === CATEGORIES.length - 1 && styles.lastRow,
                  ]}
                >
                  <Text style={styles.label}>{label}</Text>
                  {pendingCategory === key ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Switch
                      value={preference?.push ?? true}
                      onValueChange={(enabled) => void update(key, enabled)}
                      disabled={pendingCategory !== null}
                      accessibilityLabel={`Notifications push : ${label}`}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary,
                      }}
                      thumbColor={colors.onPrimary}
                    />
                  )}
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.muted}
          />
          <Text style={styles.noteText}>
            Les préférences sont enregistrées sur votre compte. Le canal de
            secours WhatsApp dépend du réglage général des notifications.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    minHeight: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  noteText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.primary, fontWeight: '700' },
});
