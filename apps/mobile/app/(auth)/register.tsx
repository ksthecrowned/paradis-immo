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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
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
  const [phone, setPhone] = useState('');
  const [country, setCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const canContinue = isPhoneComplete(phone, country);

  const handleContinue = (): void => {
    setTriedSubmit(true);
    const e164 = getPhoneE164(phone, country);
    if (!e164) return;

    router.push({
      pathname: '/(auth)/otp-verify',
      params: { phone: e164, flow: 'register' },
    });
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
          <Text style={styles.disclaimerEmphasis}>Message WhatsApp</Text> avec un code de vérification à 6 chiffres.
          Des frais de message peuvent s’appliquer.
        </Text>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              !canContinue && styles.ctaDisabled,
              pressed && canContinue && styles.ctaPressed,
            ]}
            disabled={!canContinue}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continuer"
            accessibilityState={{ disabled: !canContinue }}
          >
            <Text style={styles.ctaText}>Continuer</Text>
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
