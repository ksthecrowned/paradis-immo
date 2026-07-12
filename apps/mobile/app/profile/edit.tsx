import { AuthTextInput } from '@/components/auth/AuthTextInput';
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/components/auth/PhoneCountryCallingCode';
import { PhoneNumberField } from '@/components/auth/PhoneNumberField';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import { parseE164Phone } from '@/lib/phone';
import {
  fetchMe,
  updateMeAndSync,
  type NotificationChannelPreference,
} from '@/lib/users';
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
import { CountryCode } from 'react-native-country-picker-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHANNEL_TABS: Array<{
  key: NotificationChannelPreference;
  label: string;
}> = [
  { key: 'PUSH', label: 'Push' },
  { key: 'SMS', label: 'SMS' },
];

export default function ProfileEditScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [notificationChannel, setNotificationChannel] =
    useState<NotificationChannelPreference>('PUSH');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/edit');
        if (!active) return;
        setReady(ok);
        if (!ok) return;
        setLoading(true);
        try {
          const me = await fetchMe();
          if (!active) return;
          setName(me.name ?? '');
          setEmail(me.email ?? '');
          const parsed = parseE164Phone(me.phone);
          if (parsed) {
            setPhoneCountry({
              countryCode: parsed.countryCode as CountryCode,
              callingCode: parsed.callingCode,
            });
            setPhoneNational(parsed.national);
          } else {
            setPhoneNational(me.phone ?? '');
            setPhoneCountry(DEFAULT_PHONE_COUNTRY);
          }
          setNotificationChannel(
            me.notificationChannel === 'SMS' ? 'SMS' : 'PUSH',
          );
        } catch (err) {
          if (!active) return;
          showFeedback({
            type: 'error',
            title: 'Profil',
            message: getErrorMessage(err, 'Impossible de charger le profil'),
          });
          router.back();
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [showFeedback]),
  );

  const canSave = name.trim().length >= 2 && !saving;

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    try {
      const emailTrim = email.trim();
      await updateMeAndSync({
        name: name.trim(),
        ...(emailTrim ? { email: emailTrim } : {}),
        notificationChannel,
      });
      showFeedback({
        type: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations ont été enregistrées.',
      });
      router.back();
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Profil',
        message: getErrorMessage(err, 'Impossible d’enregistrer'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Modifier le profil" icon="person-outline" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthTextInput
          label="Nom complet"
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.muted + "20"}
          placeholder="Ex. Jean Mbemba"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          accessibilityLabel="Nom complet"
        />

        <AuthTextInput
          label="E-mail (optionnel)"
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          keyboardType="email-address"
          placeholderTextColor={colors.muted + "20"}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="E-mail"
        />

        <PhoneNumberField
          country={phoneCountry}
          onCountryChange={setPhoneCountry}
          value={phoneNational}
          onChange={setPhoneNational}
          editable={false}
          hint="Lié à votre connexion OTP"
        />

        <Pressable
          style={[styles.submit, !canSave && styles.submitDisabled]}
          onPress={() => void handleSave()}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer"
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.submitText}>Enregistrer</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  alertsBlock: {
    gap: spacing.sm,
  },
  alertsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  submit: {
    marginTop: spacing.sm,
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
