import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { SuccessScreen } from '@/components/ui/SuccessScreen';
import { colors, radii, spacing } from '@/constants/theme';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
import { getAgency, getAgent } from '@/lib/agencies';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PaymentScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    propertyId?: string;
    visitBookingId?: string;
    amount?: string;
  }>();
  const paymentId = String(params.id ?? '');
  const propertyId = String(params.propertyId ?? '');
  const visitBookingId = params.visitBookingId
    ? String(params.visitBookingId)
    : undefined;
  const amount = Number(params.amount ?? 0);

  const { property, loading } = useCatalogProperty(propertyId);
  const agency = useMemo(
    () => (property ? getAgency(property.agencyId) : undefined),
    [property],
  );
  const agent = useMemo(
    () => (property ? getAgent(property.agentId) : undefined),
    [property],
  );

  const amountLabel = useMemo(() => {
    if (!amount) return '—';
    return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
  }, [amount]);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/payment/${paymentId}?propertyId=${propertyId}&amount=${amount}${
            visitBookingId ? `&visitBookingId=${visitBookingId}` : ''
          }`,
        );
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, [paymentId, propertyId, amount, visitBookingId]),
  );

  const handlePay = (): void => {
    setSubmitting(true);
    setDone(true);
    setSubmitting(false);
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!propertyId || !property || !paymentId) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>Paiement introuvable</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <SuccessScreen
        title="Paiement enregistré"
        message="Paiement en espèces en attente de validation par l’agence. Vous serez notifié une fois confirmé."
        primaryLabel="Voir mon activité"
        onPrimary={() => router.replace('/(tabs)/activity')}
        secondaryLabel="Retour au bien"
        onSecondary={() => router.replace(`/property/${property.id}`)}
      />
    );
  }

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
        <PropertySummaryCard property={property} />

        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Visite · {property.title}</Text>
          <Text style={styles.amountValue}>{amountLabel}</Text>
        </View>

        <Text style={styles.section}>Mode de paiement</Text>
        <View style={styles.methods}>
          <View style={[styles.method, styles.methodDisabled]}>
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={colors.muted}
            />
            <Text style={[styles.methodText, styles.methodTextMuted]}>
              Mobile Money
            </Text>
          </View>
          <View style={[styles.method, styles.methodActive]}>
            <Ionicons name="cash-outline" size={18} color={colors.surface} />
            <Text style={[styles.methodText, styles.methodTextActive]}>
              Espèces
            </Text>
          </View>
        </View>
        <Text style={styles.mmHint}>Mobile Money — bientôt disponible</Text>

        <View style={styles.cashBox}>
          <Text style={styles.cashText}>
            {`Payez en espèces auprès d’un agent de ${agency?.name ?? property.agencyName ?? 'l’agence'}${
              agent || property.agentName
                ? ` (${agent?.displayName ?? property.agentName})`
                : ''
            }. Présentez la référence : ${paymentId.slice(-8).toUpperCase()}.`}
          </Text>
        </View>
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
          onPress={handlePay}
          accessibilityRole="button"
          accessibilityLabel="Confirmer le paiement espèces"
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>J’ai compris</Text>
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
    gap: 4,
  },
  amountLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  amountValue: { fontSize: 22, fontWeight: '800', color: colors.primary },
  section: { fontSize: 15, fontWeight: '800', color: colors.ink },
  methods: { flexDirection: 'row', gap: 8 },
  method: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodDisabled: {
    opacity: 0.55,
  },
  methodText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  methodTextActive: { color: colors.surface },
  methodTextMuted: { color: colors.muted },
  mmHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    marginTop: -4,
  },
  cashBox: {
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cashText: { fontSize: 14, lineHeight: 20, color: colors.muted },
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
