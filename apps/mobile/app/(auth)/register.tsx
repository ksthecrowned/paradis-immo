import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/components/auth/PhoneCountryCallingCode';
import {
  getPhoneE164,
  isPhoneComplete,
  PhoneNumberField,
} from '@/components/auth/PhoneNumberField';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { requestOtp } from '@/lib/auth';
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

export default function RegisterScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [phone, setPhone] = useState('');
  const [country, setCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [loading, setLoading] = useState(false);

  const phoneOk = isPhoneComplete(phone, country);
  const canContinue = phoneOk && !loading;

  const openLegalInfo = (title: string): void => {
    showFeedback({
      type: 'info',
      title,
      message:
        'Le document complet sera bientôt disponible. En créant un compte, vous acceptez les règles d’usage de Paradis Immo.',
    });
  };

  const handleContinue = async (): Promise<void> => {
    setTriedSubmit(true);
    if (!phoneOk) return;
    const e164 = getPhoneE164(phone, country);
    if (!e164) return;

    setLoading(true);
    try {
      await requestOtp(e164, 'REGISTER');
      router.push({
        pathname: '/(auth)/otp-verify',
        params: { phone: e164, flow: 'register' },
      });
    } catch (err) {
      const message = getErrorMessage(err, 'Impossible d’envoyer le code');
      const exists = /existe déjà|connectez-vous/i.test(message);
      showFeedback({
        type: 'error',
        title: exists ? 'Compte existant' : 'Paradis Immo',
        message,
        ...(exists
          ? {
              buttons: [
                { text: 'OK', style: 'cancel' },
                {
                  text: 'Se connecter',
                  onPress: () => router.push('/(auth)/login'),
                },
              ],
            }
          : {}),
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
          <Text style={styles.title}>Créer un compte ✍️</Text>
          <Text style={styles.subtitle}>
            Saisissez votre numéro de téléphone
          </Text>
        </View>

        <PhoneNumberField
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onChange={setPhone}
          showError={triedSubmit}
        />

        <Text style={styles.disclaimer}>
          Vous recevrez un{' '}
          <Text style={styles.disclaimerEmphasis}>Message WhatsApp</Text> avec
          un code de vérification à 6 chiffres. Des frais de message peuvent
          s’appliquer.
        </Text>

        {/* <View style={styles.consentRow}>
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={colors.primary}
            style={{ marginTop: 2 }}
          />
          <Text style={styles.consentText}>
            En créant un compte, vous acceptez les{' '}
            <Text
              style={styles.consentLink}
              onPress={() => openLegalInfo('Conditions d’utilisation')}
            >
              Conditions d’utilisation
            </Text>{' '}
            et la{' '}
            <Text
              style={styles.consentLink}
              onPress={() => openLegalInfo('Politique de confidentialité')}
            >
              Politique de confidentialité
            </Text> de Paradis Immo.
          </Text>
        </View> */}

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
            accessibilityLabel="Continuer"
            accessibilityState={{ disabled: !canContinue || loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.ctaText}>Continuer</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
          >
            <Text style={styles.loginLink}>
              Déjà un compte ?{' '}
              <Text style={styles.loginLinkAccent}>Se connecter</Text>
            </Text>
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
  disclaimerEmphasis: {
    fontWeight: '700',
    color: colors.ink,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  consentError: {
    marginTop: spacing.xs,
    marginLeft: 30,
    fontSize: 13,
    color: colors.danger,
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
    color: colors.onPrimary,
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 14,
    color: colors.muted,
  },
  loginLinkAccent: {
    color: colors.primary,
    fontWeight: '700',
  },
});
