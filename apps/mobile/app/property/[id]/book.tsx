import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  createMockPaymentSession,
  nightsBetween,
  quoteShortStay,
} from '@/lib/mock-conversion';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const START_OPTIONS = ['2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15'];
const END_OPTIONS = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'];

function labelDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function BookScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const property = useMemo(() => getPropertyById(propertyId), [propertyId]);

  const [startIso, setStartIso] = useState(START_OPTIONS[0]!);
  const [endIso, setEndIso] = useState(END_OPTIONS[1]!);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const quote = useMemo(
    () => quoteShortStay(propertyId, startIso, endIso),
    [propertyId, startIso, endIso],
  );
  const canConfirm = quote.nights > 0;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/property/${propertyId}/book`,
        );
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, [propertyId]),
  );

  const handleConfirm = (): void => {
    if (!property || !canConfirm) return;
    setSubmitting(true);
    try {
      const session = createMockPaymentSession({
        kind: 'stay',
        propertyId: property.id,
        amountLabel: quote.totalLabel,
        title: `Séjour · ${property.title}`,
      });
      router.push(`/payment/${session.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Bien introuvable</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Réserver</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        <PropertySummaryCard property={property} />

        <Text style={styles.section}>Arrivée</Text>
        <View style={styles.chipWrap}>
          {START_OPTIONS.map((iso) => {
            const active = iso === startIso;
            return (
              <Pressable
                key={iso}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setStartIso(iso);
                  if (nightsBetween(iso, endIso) <= 0) {
                    const next = END_OPTIONS.find((e) => nightsBetween(iso, e) > 0);
                    if (next) setEndIso(next);
                  }
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {labelDate(iso)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Départ</Text>
        <View style={styles.chipWrap}>
          {END_OPTIONS.map((iso) => {
            const active = iso === endIso;
            const disabled = nightsBetween(startIso, iso) <= 0;
            return (
              <Pressable
                key={iso}
                style={[
                  styles.chip,
                  active && styles.chipActive,
                  disabled && styles.chipDisabled,
                ]}
                disabled={disabled}
                onPress={() => setEndIso(iso)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {labelDate(iso)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.recap}>
          <Text style={styles.recapLabel}>Récapitulatif</Text>
          <Text style={styles.recapLine}>
            {quote.nights > 0
              ? `${quote.nights} nuit${quote.nights > 1 ? 's' : ''}`
              : 'Choisissez des dates valides'}
          </Text>
          {quote.nights > 0 ? (
            <Text style={styles.recapTotal}>{quote.totalLabel}</Text>
          ) : null}
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
            (!canConfirm || submitting) && styles.ctaDisabled,
            pressed && canConfirm && styles.ctaPressed,
          ]}
          disabled={!canConfirm || submitting}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Continuer vers le paiement"
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>Continuer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  missing: { fontSize: 17, fontWeight: '700', color: colors.ink },
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
  section: { fontSize: 15, fontWeight: '800', color: colors.ink },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  chipTextActive: { color: colors.surface },
  recap: {
    gap: 4,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recapLabel: { fontSize: 13, fontWeight: '600', color: colors.muted },
  recapLine: { fontSize: 15, fontWeight: '700', color: colors.ink },
  recapTotal: { fontSize: 18, fontWeight: '800', color: colors.primary },
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
