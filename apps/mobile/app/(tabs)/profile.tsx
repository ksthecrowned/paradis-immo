import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import {
  getStoredUser,
  logout,
  type AuthUser,
} from '@/lib/auth';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  danger?: boolean;
};

function initials(user: AuthUser | null): string {
  const name = user?.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  if (user?.phone) return user.phone.slice(-2);
  return 'PI';
}

export default function ProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await getStoredUser();
      setUser(stored);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUser();
    }, [loadUser]),
  );

  const handleLogout = (): void => {
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
            void logout().then(() => {
              router.replace('/');
            });
          },
        },
      ],
    });
  };

  const menu: MenuItem[] = [
    {
      key: 'favorites',
      label: 'Mes favoris',
      icon: 'heart-outline',
      onPress: () => router.push('/(tabs)/favorites'),
    },
    {
      key: 'activity',
      label: 'Mon activité',
      icon: 'time-outline',
      onPress: () => router.push('/(tabs)/activity'),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: 'notifications-outline',
      onPress: () => router.push('/notifications'),
    },
    {
      key: 'help',
      label: 'Aide & support',
      icon: 'help-circle-outline',
      onPress: () =>
        showFeedback({
          type: 'info',
          title: 'Support',
          message: 'Contactez-nous bientôt via WhatsApp ou e-mail.',
        }),
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Mon profil</Text>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(user)}</Text>
              </View>
              <View style={styles.identity}>
                <Text style={styles.name} numberOfLines={1}>
                  {user?.name?.trim() || 'Invité Paradis Immo'}
                </Text>
                <Text style={styles.phone} numberOfLines={1}>
                  {user?.phone || 'Connectez-vous pour synchroniser'}
                </Text>
              </View>
              {!user ? (
                <Pressable
                  style={styles.loginBtn}
                  onPress={() => router.push('/(auth)/login')}
                  accessibilityRole="button"
                >
                  <Text style={styles.loginBtnText}>Connexion</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.menu}>
          {menu.map((item) => (
            <Pressable
              key={item.key}
              style={styles.menuRow}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {user ? (
          <Pressable
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        ) : null}

        <Text style={styles.version}>Paradis Immo · Congo</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 88,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  phone: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  loginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  loginBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  menu: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
