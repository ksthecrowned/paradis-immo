import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  fetchMe,
  updateMeAndSync,
  type NotificationChannelPreference,
} from '@/lib/users';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const [phone, setPhone] = useState('');
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
          setPhone(me.phone ?? '');
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
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Modifier le profil</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Votre nom"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>E-mail (optionnel)</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={phone}
          editable={false}
        />
        <Text style={styles.hint}>Lié à votre connexion OTP</Text>

        <Text style={styles.label}>Alertes</Text>
        <SegmentTabs
          tabs={CHANNEL_TABS}
          value={notificationChannel}
          onChange={(key) =>
            setNotificationChannel(key as NotificationChannelPreference)
          }
        />
        <Text style={styles.hint}>
          {notificationChannel === 'SMS'
            ? 'Les SMS sont facturés à l’agence.'
            : 'Notifications push sur votre téléphone.'}
        </Text>

        <Pressable
          style={[styles.submit, !canSave && styles.submitDisabled]}
          onPress={() => void handleSave()}
          disabled={!canSave}
          accessibilityRole="button"
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
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  inputDisabled: {
    backgroundColor: colors.primaryMuted,
    color: colors.muted,
  },
  hint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  submit: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
