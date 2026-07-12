import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  addDays,
  formatDayLongFr,
  todayKey,
} from '@/lib/calendar';
import {
  createMockPaymentSession,
  quoteShortStay,
} from '@/lib/mock-conversion';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
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

export default function BookScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const { property, loading } = useCatalogProperty(propertyId);

  const today = todayKey();
  const [startIso, setStartIso] = useState(() => today);
  const [endIso, setEndIso] = useState(() => addDays(today, 2));
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  const quoteId = property?.id ?? propertyId;
  const quote = useMemo(
    () => quoteShortStay(quoteId, startIso, endIso),
    [quoteId, startIso, endIso],
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

  const onSelectDate = (iso: string): void => {
    // First tap / reset → start; second tap after start → end
    if (!startIso || (startIso && endIso)) {
      setStartIso(iso);
      setEndIso('');
      return;
    }
    if (iso <= startIso) {
      setStartIso(iso);
      setEndIso('');
      return;
    }
    setEndIso(iso);
  };

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
      router.push(
        `/payment/${session.id}?propertyId=${encodeURIComponent(property.id)}&amount=${quote.totalAmount}&title=${encodeURIComponent(`Séjour · ${property.title}`)}`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.missing}>Bien introuvable</Text>
        )}
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
        showsVerticalScrollIndicator={false}
      >
        <PropertySummaryCard property={property} />

        <Text style={styles.section}>Dates du séjour</Text>
        <Text style={styles.hint}>
          Touchez l’arrivée, puis le départ
        </Text>

        <MonthCalendar
          mode="range"
          rangeStart={startIso || undefined}
          rangeEnd={endIso || undefined}
          minDate={today}
          maxDate={addDays(today, 180)}
          onSelectDate={onSelectDate}
        />

        <View style={styles.dateRow}>
          <View style={styles.dateCard}>
            <Text style={styles.dateLabel}>Arrivée</Text>
            <Text style={styles.dateValue}>
              {startIso ? formatDayLongFr(startIso) : '—'}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.muted} />
          <View style={styles.dateCard}>
            <Text style={styles.dateLabel}>Départ</Text>
            <Text style={styles.dateValue}>
              {endIso ? formatDayLongFr(endIso) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.recap}>
          <Text style={styles.recapLabel}>Récapitulatif</Text>
          <Text style={styles.recapLine}>
            {quote.nights > 0
              ? `${quote.nights} nuit${quote.nights > 1 ? 's' : ''}`
              : 'Choisissez une arrivée et un départ'}
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
  hint: {
    marginTop: -8,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateCard: {
    flex: 1,
    gap: 2,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  dateValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
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
