import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { SuccessScreen } from '@/components/ui/SuccessScreen';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import { getMockPaymentSession } from '@/lib/mock-conversion';
import { getPropertyById } from '@/lib/mock-properties';
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

type PayMethod = 'mm' | 'cash';

export default function PaymentScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = String(id ?? '');
  const session = useMemo(
    () => getMockPaymentSession(paymentId),
    [paymentId],
  );
  const property = useMemo(
    () => (session ? getPropertyById(session.propertyId) : undefined),
    [session],
  );
  const agency = useMemo(
    () => (property ? getAgency(property.agencyId) : undefined),
    [property],
  );
  const agent = useMemo(
    () => (property ? getAgent(property.agentId) : undefined),
    [property],
  );

  const [method, setMethod] = useState<PayMethod>('mm');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/payment/${paymentId}`,
        );
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, [paymentId]),
  );

  const handlePay = (): void => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
    }, 500);
  };

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session || !property) {
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
        message="Merci. Votre paiement a bien été pris en compte."
        primaryLabel="Voir mon activité"
        onPrimary={() => router.replace('/(tabs)/activity')}
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
          <Text style={styles.amountLabel}>{session.title}</Text>
          <Text style={styles.amountValue}>{session.amountLabel}</Text>
        </View>

        <Text style={styles.section}>Mode de paiement</Text>
        <View style={styles.methods}>
          <Pressable
            style={[styles.method, method === 'mm' && styles.methodActive]}
            onPress={() => setMethod('mm')}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={18}
              color={method === 'mm' ? colors.surface : colors.primary}
            />
            <Text
              style={[
                styles.methodText,
                method === 'mm' && styles.methodTextActive,
              ]}
            >
              Mobile Money
            </Text>
          </Pressable>
          <Pressable
            style={[styles.method, method === 'cash' && styles.methodActive]}
            onPress={() => setMethod('cash')}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={method === 'cash' ? colors.surface : colors.primary}
            />
            <Text
              style={[
                styles.methodText,
                method === 'cash' && styles.methodTextActive,
              ]}
            >
              Espèces
            </Text>
          </Pressable>
        </View>

        {method === 'mm' ? (
          <>
            <Text style={styles.label}>Numéro Mobile Money</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+242 06 …"
              placeholderTextColor={colors.muted}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </>
        ) : (
          <View style={styles.cashBox}>
            <Text style={styles.cashText}>
              {`Payez en espèces auprès d’un agent de ${agency?.name ?? 'l’agence'}${
                agent ? ` (${agent.displayName})` : ''
              }. Présentez cette référence : ${session.id.slice(-8).toUpperCase()}.`}
            </Text>
          </View>
        )}
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
          accessibilityLabel={method === 'mm' ? 'Payer' : 'J’ai compris'}
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>
              {method === 'mm' ? 'Payer' : 'J’ai compris'}
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
  methodText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  methodTextActive: { color: colors.surface },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted },
  input: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
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
