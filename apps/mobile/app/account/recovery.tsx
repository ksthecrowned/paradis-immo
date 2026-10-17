import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import {
  cancelAccountDeletion,
  mapAccountDeletionCancelError,
  type AccountDeletionCancelErrorCode,
} from '@/lib/account-deletion';
import { logout } from '@/lib/auth';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { syncStoredUserFromApi } from '@/lib/users';
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

/** Errors that no retry can fix — the account can no longer be reactivated. */
const TERMINAL_CODES: AccountDeletionCancelErrorCode[] = [
  'ACCOUNT_DELETION_WINDOW_CLOSED',
  'ACCOUNT_ANONYMIZED',
];

type RecoveryState =
  | { kind: 'deleted' }
  | { kind: 'restored'; message: string }
  | {
      kind: 'error';
      code: AccountDeletionCancelErrorCode;
      message: string;
    };

/**
 * Spec 01 — a DELETED account can still sign in during the 30-day window, but
 * every route but `DELETE /users/me/deletion` answers 403 `ACCOUNT_DELETED`.
 * This screen is the only usable one until the deletion is cancelled, and the
 * status it shows comes from the API answer, never from an optimistic guess.
 */
export default function AccountRecoveryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<RecoveryState>({ kind: 'deleted' });
  const leavingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/account/recovery');
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const handleCancel = async (): Promise<void> => {
    if (busy || state.kind === 'restored') return;
    setBusy(true);
    setState({ kind: 'deleted' });
    try {
      const result = await cancelAccountDeletion();
      setState({
        kind: 'restored',
        message:
          result.message ||
          'Suppression annulée. Votre compte est de nouveau actif.',
      });
    } catch (err) {
      const mapped = mapAccountDeletionCancelError(err);
      setState({ kind: 'error', code: mapped.code, message: mapped.message });
    } finally {
      setBusy(false);
    }
  };

  /** Refresh the cached profile (it changed server-side) then enter the app. */
  const handleContinue = useCallback((): void => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    void (async () => {
      try {
        await syncStoredUserFromApi();
      } catch {
        // Best-effort: the account is active again, screens reload their data.
      }
      router.replace('/(tabs)');
    })();
  }, []);

  const handleLogout = useCallback((): void => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    void (async () => {
      await logout();
      router.replace('/(auth)/login');
    })();
  }, []);

  if (!ready) {
    return <View style={styles.screen} />;
  }

  const terminal =
    state.kind === 'error' && TERMINAL_CODES.includes(state.code);
  const statusLabel =
    state.kind === 'restored'
      ? 'Compte actif'
      : state.kind === 'error'
        ? 'Suppression toujours programmée'
        : 'Suppression programmée';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Compte en suppression" icon="refresh-outline" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.intro}>
            Votre compte est programmé pour suppression. Vous pouvez l’annuler
            pendant 30 jours, tant que vos données n’ont pas été anonymisées.
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={
                state.kind === 'restored'
                  ? 'checkmark-circle'
                  : 'information-circle-outline'
              }
              size={18}
              color={state.kind === 'restored' ? colors.success : colors.muted}
            />
            <Text style={styles.statusText}>Statut : {statusLabel}</Text>
          </View>
        </View>

        {state.kind === 'restored' ? (
          <View style={styles.successCard} accessibilityRole="alert">
            <Text style={styles.successTitle}>Suppression annulée</Text>
            <Text style={styles.successText}>{state.message}</Text>
            <Text style={styles.successHint}>
              Vos données, vos annonces et vos accès restent en place. Toutes
              vos sessions ont été révoquées lors de la demande : reconnectez
              les autres appareils si besoin.
            </Text>
            <Pressable
              style={styles.submit}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continuer vers l’application"
            >
              <Text style={styles.submitText}>Continuer</Text>
            </Pressable>
          </View>
        ) : null}

        {state.kind === 'error' ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Annulation impossible</Text>
            <Text style={styles.errorText}>{state.message}</Text>
            {state.code === 'ACCOUNT_DELETION_WINDOW_CLOSED' ? (
              <Text style={styles.errorHint}>
                Le délai de récupération est écoulé. Ce compte ne peut plus être
                réactivé.
              </Text>
            ) : null}
            {state.code === 'ACCOUNT_ANONYMIZED' ? (
              <Text style={styles.errorHint}>
                Les données personnelles ont déjà été anonymisées. Pour une
                question administrative, contactez le support.
              </Text>
            ) : null}
          </View>
        ) : null}

        {state.kind !== 'restored' ? (
          <>
            <Pressable
              style={[styles.submit, (busy || terminal) && styles.submitDisabled]}
              onPress={() => void handleCancel()}
              disabled={busy || terminal}
              accessibilityRole="button"
              accessibilityLabel="Annuler la suppression du compte"
              accessibilityState={{ disabled: busy || terminal, busy }}
            >
              {busy ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitText}>Annuler la suppression</Text>
              )}
            </Pressable>

            {state.kind === 'error' && !terminal ? (
              <Pressable
                style={styles.secondary}
                onPress={() => void handleCancel()}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Réessayer l’annulation"
              >
                <Text style={styles.secondaryText}>Réessayer</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        <Pressable
          style={styles.logout}
          onPress={handleLogout}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter sans annuler"
        >
          <Text style={styles.logoutText}>
            {state.kind === 'restored'
              ? 'Se déconnecter'
              : 'Se déconnecter sans annuler'}
          </Text>
        </Pressable>

        {state.kind !== 'restored' ? (
          <Text style={styles.footnote}>
            Si vous ne faites rien, les données du compte seront anonymisées à
            la fin du délai de 30 jours.
          </Text>
        ) : null}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  intro: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  successCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.success}55`,
    backgroundColor: colors.surface,
  },
  successTitle: { color: colors.success, fontSize: 15, fontWeight: '800' },
  successText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  successHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  errorCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
    backgroundColor: colors.surface,
  },
  errorTitle: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  errorText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  errorHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  submit: {
    minHeight: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  logout: { alignItems: 'center', paddingVertical: spacing.sm },
  logoutText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
