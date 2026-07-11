import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { SuccessScreen } from '@/components/ui/SuccessScreen';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import { getPropertyById } from '@/lib/mock-properties';
import {
  createMockPaymentSession,
  getMockVisitDays,
  getMockVisitSlots,
  type MockVisitSlot,
} from '@/lib/mock-conversion';
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

export default function VisitScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const property = useMemo(() => getPropertyById(propertyId), [propertyId]);
  const agency = useMemo(
    () => (property ? getAgency(property.agencyId) : undefined),
    [property],
  );
  const agent = useMemo(
    () => (property ? getAgent(property.agentId) : undefined),
    [property],
  );

  const days = useMemo(() => getMockVisitDays(propertyId), [propertyId]);
  const [dayKey, setDayKey] = useState(days[0]?.key ?? '');
  const [slotId, setSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  const slots = useMemo(
    () => getMockVisitSlots(propertyId, dayKey),
    [propertyId, dayKey],
  );
  const selected: MockVisitSlot | undefined = slots.find((s) => s.id === slotId);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/property/${propertyId}/visit`,
        );
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, [propertyId]),
  );

  const handleConfirm = (): void => {
    if (!property || !selected) return;
    setSubmitting(true);
    try {
      if (selected.paid) {
        const session = createMockPaymentSession({
          kind: 'visit',
          propertyId: property.id,
          amountLabel: selected.priceLabel ?? '5 000 FCFA',
          title: `Visite · ${property.title}`,
        });
        router.push(`/payment/${session.id}`);
        return;
      }
      setDone(true);
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

  if (done) {
    return (
      <SuccessScreen
        title="Visite réservée"
        message="Votre créneau est confirmé. Retrouvez-le dans Mon activité."
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
        <Text style={styles.topTitle}>Visite</Text>
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
        <Text style={styles.attribution}>
          Visite avec {agent?.displayName ?? 'un agent'} ·{' '}
          {agency?.shortName ?? 'Agence'}
        </Text>

        <Text style={styles.section}>Jour</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayRow}
        >
          {days.map((day) => {
            const active = day.key === dayKey;
            return (
              <Pressable
                key={day.key}
                style={[styles.dayChip, active && styles.dayChipActive]}
                onPress={() => {
                  setDayKey(day.key);
                  setSlotId(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.dayText, active && styles.dayTextActive]}>
                  {day.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.section}>Créneaux</Text>
        {slots.length === 0 ? (
          <Text style={styles.empty}>Aucun créneau pour ce jour.</Text>
        ) : (
          slots.map((slot) => {
            const active = slot.id === slotId;
            return (
              <Pressable
                key={slot.id}
                style={[styles.slot, active && styles.slotActive]}
                onPress={() => setSlotId(slot.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={styles.slotLeft}>
                  <Text style={[styles.slotTime, active && styles.slotTimeActive]}>
                    {slot.startLabel} – {slot.endLabel}
                  </Text>
                  <Text style={[styles.slotMeta, active && styles.slotMetaActive]}>
                    {slot.paid ? slot.priceLabel : 'Gratuit'}
                  </Text>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={active ? colors.surface : colors.primary}
                />
              </Pressable>
            );
          })
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
            (!selected || submitting) && styles.ctaDisabled,
            pressed && selected && styles.ctaPressed,
          ]}
          disabled={!selected || submitting}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Confirmer la visite"
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>Confirmer</Text>
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
  attribution: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  section: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  dayRow: { gap: 8 },
  dayChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  dayTextActive: { color: colors.surface },
  empty: { fontSize: 14, color: colors.muted },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotLeft: { gap: 2 },
  slotTime: { fontSize: 15, fontWeight: '700', color: colors.ink },
  slotTimeActive: { color: colors.surface },
  slotMeta: { fontSize: 13, fontWeight: '500', color: colors.muted },
  slotMetaActive: { color: 'rgba(255,255,255,0.85)' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
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
