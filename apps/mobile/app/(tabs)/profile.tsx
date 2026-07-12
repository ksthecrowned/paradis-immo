import { MenuSection, type MenuItem } from '@/components/ui/MenuSection';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  colors,
  getBootColorScheme,
  radii,
  spacing,
} from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import {
  getStoredUser,
  logout,
  type AuthUser,
} from '@/lib/auth';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import { applyThemePreference } from '@/lib/theme-preference';
import { getUserPreferences } from '@/lib/user-preferences';
import { syncStoredUserFromApi } from '@/lib/users';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isDarkBoot = getBootColorScheme() === 'dark';

export default function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(isDarkBoot);
  const [themeBusy, setThemeBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadUser = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const [me, prefs] = await Promise.all([
        syncStoredUserFromApi(),
        getUserPreferences(),
      ]);
      setUser(me ?? (await getStoredUser()));
      setIsDark(
        prefs.theme === 'dark' ||
          (prefs.theme === 'system' && getBootColorScheme() === 'dark'),
      );
    } catch (err) {
      const stored = await getStoredUser();
      setUser(stored);
      setError(
        getErrorMessage(err, 'Impossible de synchroniser le profil'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/(tabs)/profile');
        if (!active) return;
        if (ok) await loadUser();
        else {
          setUser(null);
          setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [loadUser]),
  );

  const handleLogout = useCallback((): void => {
    if (loggingOut) return;
    showFeedback({
      type: 'warning',
      title: 'Déconnexion',
      message: 'Voulez-vous vraiment vous déconnecter ?',
      buttons: [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: () => {
            setLoggingOut(true);
            void logout()
              .then(() => {
                // `/welcome` — not `/` — because `(tabs)/index` also maps to `/`.
                router.replace('/welcome');
              })
              .catch(() => {
                setLoggingOut(false);
                showFeedback({
                  type: 'error',
                  title: 'Déconnexion',
                  message: 'Impossible de se déconnecter. Réessayez.',
                });
              });
          },
        },
      ],
    });
  }, [loggingOut, showFeedback]);

  const toggleTheme = useCallback(async (): Promise<void> => {
    if (themeBusy) return;
    setThemeBusy(true);
    try {
      await applyThemePreference(isDark ? 'light' : 'dark');
    } catch {
      setThemeBusy(false);
      showFeedback({
        type: 'error',
        title: 'Thème',
        message: 'Impossible de changer le thème.',
      });
    }
  }, [isDark, showFeedback, themeBusy]);

  const displayName = user?.name?.trim() || 'Invité Paradis Immo';

  const activityItems = useMemo<MenuItem[]>(
    () => [
      {
        id: 'leases',
        label: 'Mes biens',
        icon: 'business-outline',
        onPress: () => router.push('/(tabs)/locations'),
      },
      {
        id: 'favorites',
        label: 'Mes favoris',
        icon: 'heart-outline',
        onPress: () => router.push('/(tabs)/favorites'),
      },
      {
        id: 'activity',
        label: 'Mon historique',
        icon: 'time-outline',
        onPress: () => router.push('/activity'),
      },
      {
        id: 'documents',
        label: 'Mes documents',
        icon: 'document-text-outline',
        onPress: () => router.push('/profile/documents'),
      },
    ],
    [],
  );

  const accountItems = useMemo<MenuItem[]>(
    () => [
      {
        id: 'theme',
        label: isDark ? 'Passer au thème clair' : 'Passer au thème sombre',
        icon: isDark ? 'sunny-outline' : 'moon-outline',
        onPress: () => {
          void toggleTheme();
        },
      },
      {
        id: 'settings',
        label: 'Réglages',
        icon: 'settings-outline',
        onPress: () => router.push('/profile/settings'),
      },
    ],
    [isDark, toggleTheme],
  );

  const helpItems = useMemo<MenuItem[]>(
    () => [
      {
        id: 'help',
        label: 'Aide & support',
        icon: 'help-circle-outline',
        onPress: () =>
          showFeedback({
            type: 'info',
            title: 'Support',
            message: 'Contactez-nous bientôt via WhatsApp ou e-mail.',
          }),
      },
    ],
    [showFeedback],
  );

  const sessionItems = useMemo<MenuItem[]>(
    () =>
      user
        ? [
            {
              id: 'logout',
              label: loggingOut ? 'Déconnexion…' : 'Déconnexion',
              icon: 'log-out-outline',
              iconColor: colors.danger,
              labelColor: colors.danger,
              disabled: loggingOut,
              onPress: handleLogout,
            },
          ]
        : [
            {
              id: 'login',
              label: 'Se connecter',
              icon: 'log-in-outline',
              onPress: () => router.push('/(auth)/login'),
            },
          ],
    [user, handleLogout, loggingOut],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Profil"
        showBack={false}
        trailing={
          <Pressable
            style={styles.headerAction}
            disabled={loggingOut}
            onPress={() =>
              user
                ? router.push('/profile/edit')
                : router.push('/(auth)/login')
            }
            accessibilityRole="button"
            accessibilityLabel={
              user ? 'Modifier le profil' : 'Se connecter'
            }
          >
            <Ionicons
              name={user ? 'create-outline' : 'log-in-outline'}
              size={22}
              color={colors.ink}
            />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        pointerEvents={loggingOut ? 'none' : 'auto'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (loggingOut) return;
              setRefreshing(true);
              void loadUser({ soft: true });
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loggingOut ? (
          <View style={styles.loggingOutBanner} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loggingOutText}>Déconnexion en cours…</Text>
          </View>
        ) : null}
        {loading ? (
          <View style={styles.headerLoading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <Pressable
            style={styles.profileCard}
            onPress={() =>
              user
                ? router.push('/profile/edit')
                : router.push('/(auth)/login')
            }
            accessibilityRole="button"
            accessibilityLabel="Profil"
          >
            <UserAvatar
              name={user?.name}
              phone={user?.phone}
              email={user?.email}
              size={68}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {user?.phone || 'Connectez-vous pour synchroniser'}
              </Text>
              {user?.email ? (
                <Text style={styles.email} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}

        {error ? (
          <Pressable style={styles.syncWarn} onPress={() => void loadUser()}>
            <Ionicons
              name="cloud-offline-outline"
              size={16}
              color="#B45309"
            />
            <Text style={styles.syncWarnText}>{error} · Réessayer</Text>
          </Pressable>
        ) : null}

        <MenuSection title="Activité" items={activityItems} />
        <MenuSection title="Compte" items={accountItems} />
        <MenuSection title="Aide" items={helpItems} />
        <MenuSection title="Session" items={sessionItems} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerAction: {
    width: 50,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.lg,
  },
  headerLoading: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loggingOutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryMuted,
  },
  loggingOutText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileInfo: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  email: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  syncWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.warningSoft,
  },
  syncWarnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
});
