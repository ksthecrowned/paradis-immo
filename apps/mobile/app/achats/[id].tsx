import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import { initiatePayment } from '@/lib/payments';
import {
  canPayInstallment,
  getMySaleAgreement,
  saleAgreementStatusLabel,
  saleInstallmentStatusLabel,
  type PublicSaleAgreement,
  type PublicSaleInstallment,
} from '@/lib/sale-agreements';
import { useFeedback } from '@/context/FeedbackContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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

function formatMoney(amount: string | number, currency: string): string {
  return `${Number(amount).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ${currency}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function AchatDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agreementId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<PublicSaleAgreement | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getMySaleAgreement(agreementId));
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le dossier'));
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/achats/${agreementId}`);
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [agreementId, load]),
  );

  const onPay = async (installment: PublicSaleInstallment): Promise<void> => {
    if (!row) return;
    setPayingId(installment.id);
    try {
      const payment = await initiatePayment({
        amount: Number(installment.amount),
        currency: installment.currency || 'XAF',
        method: 'CASH',
        idempotencyKey: `sale-${installment.id}-${Date.now()}`,
        saleInstallmentId: installment.id,
      });
      const total = Number(payment.amount);
      const qs = new URLSearchParams({
        propertyId: row.propertyId,
        amount: String(total),
        saleInstallmentId: installment.id,
        title: installment.label || `Palier · ${formatDate(installment.dueDate)}`,
      });
      router.push(`/payment/${payment.id}?${qs.toString()}`);
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Paiement',
        message: getErrorMessage(err, 'Impossible d’initier le paiement'),
      });
    } finally {
      setPayingId(null);
    }
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !row) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>{error ?? 'Dossier introuvable'}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const canAct = row.status === 'ACTIVE';

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Dossier achat</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{row.propertyTitle}</Text>
        <View style={styles.metaRow}>
          <StatusBadge
            label={saleAgreementStatusLabel(row.status)}
            tone={
              row.status === 'ACTIVE'
                ? 'success'
                : row.status === 'CANCELLED'
                  ? 'danger'
                  : 'neutral'
            }
          />
          <Text style={styles.price}>
            {formatMoney(row.agreedPrice, row.currency)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Paliers</Text>
        {row.installments.map((installment) => {
          const payable =
            canAct &&
            canPayInstallment(installment.status) &&
            payingId !== installment.id;
          return (
            <View key={installment.id} style={styles.line}>
              <View style={styles.lineBody}>
                <Text style={styles.lineLabel}>
                  {installment.label || `Palier ${installment.position + 1}`}
                </Text>
                <Text style={styles.lineMeta}>
                  Échéance {formatDate(installment.dueDate)} ·{' '}
                  {saleInstallmentStatusLabel(installment.status)}
                </Text>
                <Text style={styles.lineAmount}>
                  {formatMoney(installment.amount, installment.currency)}
                </Text>
              </View>
              {payable ? (
                <Pressable
                  style={styles.payBtn}
                  onPress={() => void onPay(installment)}
                  accessibilityRole="button"
                >
                  <Text style={styles.payBtnText}>Payer</Text>
                </Pressable>
              ) : payingId === installment.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : null}
            </View>
          );
        })}
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
    gap: spacing.sm,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  spacer: { width: 40 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  price: { fontSize: 16, fontWeight: '700', color: colors.ink },
  sectionTitle: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineBody: { flex: 1, gap: 4 },
  lineLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  lineMeta: { fontSize: 13, color: colors.muted },
  lineAmount: { fontSize: 15, fontWeight: '600', color: colors.ink },
  payBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  missing: {
    color: colors.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  backLink: { padding: spacing.sm },
  backLinkText: { color: colors.primary, fontWeight: '600' },
});
