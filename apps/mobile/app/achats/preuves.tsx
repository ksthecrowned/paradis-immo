import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMyBuyerPaymentProofs,
  respondBuyerPaymentProof,
  type PublicBuyerPaymentProof,
} from '@/lib/buyer-payment-proofs';
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

function statusLabel(status: PublicBuyerPaymentProof['status']): string {
  switch (status) {
    case 'PENDING':
      return 'En attente de votre réponse';
    case 'GRANTED':
      return 'Acceptée';
    case 'DENIED':
      return 'Refusée';
    case 'EXPIRED':
      return 'Expirée';
  }
}

function statusTone(
  status: PublicBuyerPaymentProof['status'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'GRANTED') return 'success';
  if (status === 'DENIED') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

export default function BuyerPaymentProofsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PublicBuyerPaymentProof[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMyBuyerPaymentProofs());
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les demandes'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/achats/preuves');
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const handleRespond = async (id: string, accept: boolean): Promise<void> => {
    setBusyId(id);
    setError(null);
    try {
      await respondBuyerPaymentProof(id, accept);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de répondre'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topBar}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Preuves de paiements</Text>
        <View style={styles.spacer} />
      </View>

      {!ready || loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={styles.hint}>
            Un vendeur peut vous demander de confirmer le partage de vos
            paiements vérifiés.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rows.length === 0 ? (
            <Text style={styles.empty}>Aucune demande pour le moment.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.org}>{row.organizationName}</Text>
                  <StatusBadge
                    label={statusLabel(row.status)}
                    tone={statusTone(row.status)}
                  />
                </View>
                {row.status === 'PENDING' ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.btn, styles.btnDeny]}
                      disabled={busyId === row.id}
                      onPress={() => void handleRespond(row.id, false)}
                    >
                      <Text style={styles.btnDenyText}>Refuser</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnAccept]}
                      disabled={busyId === row.id}
                      onPress={() => void handleRespond(row.id, true)}
                    >
                      {busyId === row.id ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.btnAcceptText}>Accepter</Text>
                      )}
                    </Pressable>
                  </View>
                ) : row.status === 'GRANTED' ? (
                  <Text style={styles.confirmation}>
                    Votre preuve de paiements a été partagée.
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  spacer: { width: 54 },
  loader: { marginTop: 40 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '600' },
  empty: { color: colors.muted, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: { gap: spacing.xs },
  org: { fontSize: 16, fontWeight: '700', color: colors.ink },
  confirmation: { fontSize: 13, color: colors.success },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDeny: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  btnDenyText: { fontWeight: '700', color: colors.ink },
  btnAccept: { backgroundColor: colors.primary },
  btnAcceptText: { fontWeight: '700', color: colors.onPrimary },
});
