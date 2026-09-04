import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SuccessScreen } from '@/components/ui/SuccessScreen';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  getPayment,
  initiatePayment,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  type MobileProvider,
  type PublicPayment,
} from '@/lib/payments';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

function paramValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function formatXaf(value: number): string {
  return `${value.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

function buildIdempotencyKey(opts: {
  rentScheduleId?: string;
  saleInstallmentId?: string;
  visitBookingId?: string;
  propertyId: string;
  amount: number;
}): string {
  if (opts.rentScheduleId) return `mm-rent-${opts.rentScheduleId}`;
  if (opts.saleInstallmentId) return `mm-sale-${opts.saleInstallmentId}`;
  if (opts.visitBookingId) return `mm-visit-${opts.visitBookingId}`;
  return `mm-pay-${opts.propertyId}-${opts.amount}`;
}

export default function PaymentScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const params = useLocalSearchParams<{
    id: string;
    propertyId?: string;
    visitBookingId?: string;
    amount?: string;
    currency?: string;
    rentScheduleId?: string;
    saleInstallmentId?: string;
    title?: string;
  }>();

  const paymentId = paramValue(params.id);
  const isCheckout = paymentId === 'checkout';

  const propertyId = paramValue(params.propertyId);
  const visitBookingId = paramValue(params.visitBookingId) || undefined;
  const rentScheduleId = paramValue(params.rentScheduleId) || undefined;
  const saleInstallmentId = paramValue(params.saleInstallmentId) || undefined;
  const titleParam = paramValue(params.title);
  const currency = paramValue(params.currency) || 'XAF';
  const amount = Number(paramValue(params.amount) || 0);

  const { property: catalogProperty, loading: propertyLoading } =
    useCatalogProperty(propertyId);
  const property = catalogProperty;

  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [provider, setProvider] = useState<MobileProvider>('AIRTEL');
  const [phone, setPhone] = useState('');
  const [existing, setExisting] = useState<PublicPayment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(!isCheckout);

  const returnHref = useMemo(() => {
    const qs = new URLSearchParams();
    if (propertyId) qs.set('propertyId', propertyId);
    if (amount > 0) qs.set('amount', String(amount));
    if (currency) qs.set('currency', currency);
    if (visitBookingId) qs.set('visitBookingId', visitBookingId);
    if (rentScheduleId) qs.set('rentScheduleId', rentScheduleId);
    if (saleInstallmentId) qs.set('saleInstallmentId', saleInstallmentId);
    if (titleParam) qs.set('title', titleParam);
    const q = qs.toString();
    return `/payment/${paymentId}${q ? `?${q}` : ''}`;
  }, [
    paymentId,
    propertyId,
    amount,
    currency,
    visitBookingId,
    rentScheduleId,
    saleInstallmentId,
    titleParam,
  ]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, returnHref);
        if (!active) return;
        setReady(ok);
        if (!ok || isCheckout) {
          setLoadingPayment(false);
          return;
        }
        setLoadingPayment(true);
        setLoadError(null);
        try {
          const payment = await getPayment(paymentId);
          if (active) setExisting(payment);
        } catch (err) {
          if (active) {
            setExisting(null);
            setLoadError(
              getErrorMessage(err, 'Impossible de charger le paiement'),
            );
          }
        } finally {
          if (active) setLoadingPayment(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [returnHref, isCheckout, paymentId]),
  );

  const displayAmount = useMemo(() => {
    if (existing) return formatXaf(Number(existing.amount));
    if (amount > 0) return formatXaf(amount);
    return '—';
  }, [existing, amount]);

  const payTitle =
    titleParam ||
    (property ? `Paiement · ${property.title}` : 'Paiement');

  const agencyName = property?.agencyName ?? 'l’agence';
  const agentName = property?.agentName;

  const handleConfirm = async (): Promise<void> => {
    if (!isCheckout) {
      setDone(true);
      return;
    }

    if (!propertyId || amount <= 0) {
      showFeedback({
        type: 'error',
        title: 'Paiement',
        message: 'Montant ou bien manquant.',
      });
      return;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      showFeedback({
        type: 'error',
        title: 'Mobile Money',
        message: 'Indiquez un numéro de téléphone valide.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payment = await initiatePayment({
        amount,
        currency,
        method: 'MOBILE_MONEY',
        provider,
        phone: phone.trim(),
        idempotencyKey: buildIdempotencyKey({
          rentScheduleId,
          saleInstallmentId,
          visitBookingId,
          propertyId,
          amount,
        }),
        ...(rentScheduleId ? { rentScheduleId } : {}),
        ...(saleInstallmentId ? { saleInstallmentId } : {}),
        ...(visitBookingId ? { visitBookingId } : {}),
      });
      setExisting(payment);
      setDone(true);
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Paiement',
        message: getErrorMessage(err, 'Impossible d’initier le paiement'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (
    !ready ||
    loadingPayment ||
    (propertyLoading && !property && !!propertyId)
  ) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError || (!isCheckout && !existing)) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>Paiement introuvable</Text>
        <Text style={styles.missingHint}>
          {loadError ?? 'Référence manquante ou invalide.'}
        </Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (isCheckout && (!propertyId || !property || amount <= 0)) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>Paiement introuvable</Text>
        <Text style={styles.missingHint}>
          {!propertyId
            ? 'Bien manquant pour ce paiement.'
            : amount <= 0
              ? 'Montant manquant.'
              : 'Impossible de charger le bien associé.'}
        </Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <SuccessScreen
        title="Paiement initié"
        message="Confirmez sur votre téléphone. Le statut sera mis à jour dès réception de la confirmation."
        primaryLabel="Retour à mes biens"
        onPrimary={() => router.replace('/(tabs)/locations')}
        secondaryLabel={property ? 'Retour au bien' : undefined}
        onSecondary={
          property ? () => router.replace(`/property/${property.id}`) : undefined
        }
      />
    );
  }

  const showCheckoutForm = isCheckout;
  const showExisting = !isCheckout && existing;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Paiement</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {property ? <PropertySummaryCard property={property} /> : null}

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{payTitle}</Text>
          <Text style={styles.amountValue}>{displayAmount}</Text>
          {showExisting ? (
            <View style={styles.statusRow}>
              <StatusBadge
                label={paymentStatusLabel(existing.status)}
                tone={paymentStatusTone(existing.status)}
              />
              <Text style={styles.refText}>
                Réf. {existing.reference || existing.id.slice(-8).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {showCheckoutForm ? (
          <>
            <Text style={styles.section}>Mobile Money</Text>
            <View style={styles.mmBox}>
              <Text style={styles.mmLabel}>Opérateur</Text>
              <View style={styles.providers}>
                {(['AIRTEL', 'MOMO'] as MobileProvider[]).map((p) => (
                  <Pressable
                    key={p}
                    style={[
                      styles.providerChip,
                      provider === p && styles.providerChipActive,
                    ]}
                    onPress={() => setProvider(p)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: provider === p }}
                  >
                    <Text
                      style={[
                        styles.providerText,
                        provider === p && styles.providerTextActive,
                      ]}
                    >
                      {p === 'AIRTEL' ? 'Airtel Money' : 'MoMo'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.mmLabel}>Numéro</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="06 XXX XX XX"
                placeholderTextColor="#4B5563"
                autoComplete="tel"
              />
              <Text style={styles.mmHint}>
                Vous recevrez une demande de confirmation sur ce numéro
                (simulation en environnement de test).
              </Text>
            </View>
            <View style={styles.cashNote}>
              <Text style={styles.cashNoteText}>
                {`Paiement en espèces : rien à faire dans l’app. Remettez l’argent à ${
                  agentName ? agentName : `un agent de ${agencyName}`
                } — l’enregistrement se fait depuis le tableau de bord gérant.`}
              </Text>
            </View>
          </>
        ) : null}

        {showExisting ? (
          <View style={styles.cashNote}>
            <Text style={styles.cashNoteText}>
              {existing.method === 'MOBILE_MONEY'
                ? `Mobile Money (${existing.provider ?? '—'}) — ${paymentStatusLabel(existing.status)}. Surveillez votre téléphone pour confirmer.`
                : `Paiement en espèces — ${paymentStatusLabel(existing.status)}. Géré par l’agence depuis le tableau de bord.`}
            </Text>
            <Text style={styles.mmHint}>
              Mode : {paymentMethodLabel(existing.method)}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            submitting && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
          disabled={submitting}
          onPress={() => void handleConfirm()}
          accessibilityRole="button"
          accessibilityLabel={
            isCheckout ? 'Initier le paiement Mobile Money' : 'Fermer'
          }
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>
              {isCheckout ? 'Payer · Mobile Money' : 'Fermer'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  missing: { fontSize: 17, fontWeight: '700', color: colors.ink },
  missingHint: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  backLink: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  backLinkText: { color: colors.surface, fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 54 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  amountCard: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryMuted,
    gap: 8,
  },
  amountLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  amountValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  refText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  section: { fontSize: 15, fontWeight: '800', color: colors.ink },
  mmBox: {
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  mmLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  providers: { flexDirection: 'row', gap: 8 },
  providerChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  providerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  providerText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  providerTextActive: { color: colors.primary },
  phoneInput: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  mmHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    lineHeight: 18,
  },
  cashNote: {
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cashNoteText: { fontSize: 14, lineHeight: 20, color: colors.muted },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  cta: {
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryHover },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 16, fontWeight: '700', color: colors.surface },
});
