import { AuthTextInput } from '@/components/auth/AuthTextInput';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import {
  mapAccountDeletionRequestError,
  requestAccountDeletion,
  type AccountDeletionRequestError,
} from '@/lib/account-deletion';
import { logout } from '@/lib/auth';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Typed by the user — a mis-tap alone can never delete the account. */
const CONFIRMATION_WORD = 'SUPPRIMER';

const CONSEQUENCES = [
  'Votre compte est désactivé immédiatement et toutes vos sessions sont fermées.',
  'Vos annonces et accès sont retirés ; vos données personnelles sont anonymisées sous 30 jours.',
  'Vous pouvez annuler en vous reconnectant avec votre numéro avant la fin de ce délai (dans l’app ou sur le portail web) ; ensuite la suppression est définitive.',
  'Un bail, un séjour, une vente en cours ou un loyer dû bloque la demande : réglez-le d’abord.',
];

export default function DeleteAccountScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [ready, setReady] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AccountDeletionRequestError | null>(null);
  const finishedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/delete-account');
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  /** The account is already disabled server-side: drop the local session. */
  const finishSession = useCallback((): void => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    void (async () => {
      await logout();
      router.replace('/(auth)/login');
    })();
  }, []);

  const canSubmit =
    !submitting && confirmation.trim().toUpperCase() === CONFIRMATION_WORD;

  const handleDelete = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestAccountDeletion();
      showFeedback({
        type: 'success',
        title: 'Suppression programmée',
        message: `${result.message} Vous allez être déconnecté de cet appareil. Jusqu’au 30e jour, vous pouvez annuler en vous reconnectant avec votre numéro.`,
        buttons: [{ text: 'Fermer', onPress: finishSession }],
        onDismiss: finishSession,
      });
      // Keep `submitting` true: the account is gone, no second request.
    } catch (err) {
      setError(mapAccountDeletionRequestError(err));
      setSubmitting(false);
    }
  };

  if (!ready) {
    // Unauthenticated: `ensureAuthenticated` already pushed the login screen.
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Supprimer mon compte" icon="trash-outline" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <Text style={styles.warningTitle}>Action définitive</Text>
          </View>
          {CONSEQUENCES.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Demande impossible</Text>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.blockers.length > 0 ? (
              <View style={styles.blockers}>
                {error.blockers.map((blocker) => (
                  <View key={blocker} style={styles.bulletRow}>
                    <Text style={styles.blockerBullet}>•</Text>
                    <Text style={styles.blockerText}>{blocker}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable
              onPress={() => void handleDelete()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Réessayer la demande de suppression"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text style={styles.retry}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        <AuthTextInput
          label={`Tapez ${CONFIRMATION_WORD} pour confirmer`}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={CONFIRMATION_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
          hint="Cette saisie remplace une case à cocher : elle évite toute suppression accidentelle."
          accessibilityLabel={`Tapez ${CONFIRMATION_WORD} pour confirmer la suppression`}
        />

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={() => void handleDelete()}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Demander la suppression du compte"
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.submitText}>Demander la suppression</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.cancel}
          onPress={() => router.back()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Revenir sans supprimer le compte"
        >
          <Text style={styles.cancelText}>Revenir sans supprimer</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  warningCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    backgroundColor: colors.surface,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  bulletText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  errorCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    backgroundColor: colors.surface,
  },
  errorTitle: { fontSize: 15, fontWeight: '800', color: colors.danger },
  errorText: { fontSize: 14, lineHeight: 20, color: colors.ink },
  blockers: { gap: spacing.xs },
  blockerBullet: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  blockerText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  retry: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  submit: {
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.45 },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
});
