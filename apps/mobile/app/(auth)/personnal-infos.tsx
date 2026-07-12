import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { apiFetch } from '@/lib/api';
import {
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveTokens,
} from '@/lib/auth';
import { getErrorMessage } from '@/lib/feedback';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MeResponse = {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  roles?: string[];
};

export default function PersonnalInfosScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const canContinue = name.trim().length >= 2;

  const handleContinue = async (): Promise<void> => {
    if (!canContinue || loading) return;
    setLoading(true);
    try {
      const me = await apiFetch<MeResponse>('/users/me', {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      const [accessToken, refreshToken, stored] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
        getStoredUser(),
      ]);
      if (accessToken && refreshToken) {
        await saveTokens({
          accessToken,
          refreshToken,
          user: {
            id: me.id,
            phone: me.phone,
            name: me.name,
            email: me.email ?? null,
            roles: me.roles ?? stored?.roles ?? [],
          },
        });
      }
      router.replace('/(tabs)');
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Paradis Immo',
        message: getErrorMessage(
          err,
          'Impossible d’enregistrer le profil',
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <CircleIconButton
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>

        <View style={styles.header}>
          <Text style={styles.title}>Vos informations ✨</Text>
          <Text style={styles.subtitle}>
            Comment souhaitez-vous être appelé sur Paradis Immo ?
          </Text>
        </View>

        <AuthTextInput
          label="Nom complet"
          value={name}
          onChangeText={setName}
          placeholder="Ex. Jean Mbemba"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          accessibilityLabel="Nom complet"
        />

        <Text style={styles.disclaimer}>
          Vous pourrez modifier ces informations plus tard dans votre profil.
        </Text>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              (!canContinue || loading) && styles.ctaDisabled,
              pressed && canContinue && !loading && styles.ctaPressed,
            ]}
            disabled={!canContinue || loading}
            onPress={() => void handleContinue()}
            accessibilityRole="button"
            accessibilityLabel="Terminer"
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.ctaText}>Terminer</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Passer cette étape"
          >
            <Text style={styles.skipLink}>Passer pour l’instant</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
  },
  disclaimer: {
    marginTop: spacing.md,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  cta: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  skipLink: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
});
