import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { todayKey } from '@/lib/calendar';
import { formatDateFr } from '@/lib/format-date-fr';
import { getErrorMessage } from '@/lib/feedback';
import {
  canCancelBooking,
  canRescheduleBooking,
  cancelVisit,
  listMyVisits,
  listVisitSlots,
  rescheduleVisit,
  visitHoldCountdown,
  visitRefundQuote,
  visitStatusLabel,
  visitStatusTone,
  type PublicVisitBooking,
} from '@/lib/visits';
import {
  groupVisitSlotsByDay,
  type VisitDay,
  type VisitSlotRow,
} from '@/lib/visit-ui';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatTimeLabel(value: string): string {
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function VisitDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const visitId = String(id ?? '');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState<PublicVisitBooking | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [ready, setReady] = useState(false);
  /** Tick secondes pour le compte à rebours du hold 15 min. */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (visit?.status !== 'PENDING' || !visit?.holdExpiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visit?.status, visit?.holdExpiresAt]);

  const { property } = useCatalogProperty(visit?.propertyId ?? '');

  const load = useCallback(async () => {
    try {
      const visits = await listMyVisits();
      setVisit(visits.find((v) => v.id === visitId) ?? null);
    } catch (err) {
      showFeedback({
        title: 'Erreur',
        message: getErrorMessage(err, 'Impossible de charger la visite'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [visitId, showFeedback]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/visit-detail/${visitId}`,
        );
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [visitId, load]),
  );

  const onConfirmCancel = useCallback(() => {
    if (!visit) return;
    const quote = visitRefundQuote(visit);
    const refundSentence = quote
      ? `

Remboursement estimé : ${quote.refundPercent}% de ${quote.priceAmount ?? 'montant'} ${quote.currency ?? 'XAF'}.`
      : '';
    Alert.alert(
      'Annuler la visite',
      `Confirmez-vous l’annulation de cette visite ?${refundSentence}`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Annuler la visite',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await cancelVisit(visit.id);
                showFeedback({
                  title: 'Visite annulée',
                  message: 'Votre visite a bien été annulée.',
                  type: 'success',
                });
                await load();
              } catch (err) {
                showFeedback({
                  title: 'Erreur',
                  message: getErrorMessage(
                    err,
                    'Impossible d’annuler la visite',
                  ),
                  type: 'error',
                });
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [visit, load, showFeedback]);

  const onRescheduled = useCallback(
    (row: VisitSlotRow) => {
      if (!visit) return;
      void (async () => {
        setBusy(true);
        try {
          await rescheduleVisit(visit.id, row.id);
          showFeedback({
            title: 'Visite reprogrammée',
            message: 'Votre visite a été déplacée sur le nouveau créneau.',
            type: 'success',
          });
          setRescheduleOpen(false);
          await load();
        } catch (err) {
          showFeedback({
            title: 'Erreur',
            message: getErrorMessage(
              err,
              'Impossible de reprogrammer la visite',
            ),
            type: 'error',
          });
        } finally {
          setBusy(false);
        }
      })();
    },
    [visit, load, showFeedback],
  );

  const mapsUrl = useMemo(() => {
    if (!property?.location) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      property.location,
    )}`;
  }, [property?.location]);

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Visite introuvable</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const canCancel = canCancelBooking(visit);
  const canReschedule = canRescheduleBooking(visit);
  const startAt = visit.slotStartAt ?? null;
  const quote = visitRefundQuote(visit);
  const holdLabel = now ? visitHoldCountdown(visit) : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Visite</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.hero}>
          <StatusBadge
            label={visitStatusLabel(visit.status)}
            tone={visitStatusTone(visit.status)}
          />
          <Text style={styles.title}>{property?.title ?? 'Bien'}</Text>
          <Text style={styles.location}>{property?.location ?? ''}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créneau</Text>
          {startAt ? (
            <>
              <Row label="Date" value={formatDateFr(startAt.slice(0, 10))} />
              <Row
                label="Heure"
                value={`${formatTimeLabel(startAt)}${
                  visit.slotEndAt ? ` – ${formatTimeLabel(visit.slotEndAt)}` : ''
                }`}
              />
            </>
          ) : (
            <Text style={styles.hint}>Créneau indisponible</Text>
          )}
          {holdLabel ? (
            <Text style={styles.holdText}>
              <Ionicons name="timer-outline" size={14} color={colors.warning} />{' '}
              Paiement à confirmer — hold {holdLabel}
            </Text>
          ) : null}
          {quote && quote.refundPercent > 0 ? (
            <Text style={styles.hint}>
              En cas d’annulation : remboursement {quote.refundPercent}%•
            </Text>
          ) : null}
        </View>

        {(property?.agencyName || property?.agentPhone) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agence</Text>
            <Text style={styles.body}>
              {property?.agencyName ?? 'Agence'}
              {property?.agentName ? ` · ${property?.agentName}` : ''}
            </Text>
            {property?.agentPhone ? (
              <Pressable
                style={styles.contactBtn}
                onPress={() =>
                  void Linking.openURL(`tel:${property.agentPhone}`)
                }
                accessibilityRole="button"
                accessibilityLabel="Appeler l’agence"
              >
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={colors.surface}
                />
                <Text style={styles.contactText}>Contacter</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {mapsUrl ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => void Linking.openURL(mapsUrl)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir l’itinéraire"
          >
            <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>Itinéraire</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push(`/property/${visit.propertyId}`)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Voir l’annonce</Text>
        </Pressable>

        {canReschedule ? (
          <Pressable
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => setRescheduleOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Reprogrammer la visite"
          >
            <Text style={styles.primaryText}>Reprogrammer</Text>
          </Pressable>
        ) : null}

        {canCancel ? (
          <Pressable
            style={[styles.dangerBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={onConfirmCancel}
            accessibilityRole="button"
            accessibilityLabel="Annuler la visite"
          >
            <Text style={styles.dangerText}>Annuler la visite</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={rescheduleOpen}
        animationType="slide"
        onRequestClose={() => setRescheduleOpen(false)}
      >
        <ReschedulePicker
          propertyId={visit.propertyId}
          currentSlotId={visit.slotId}
          busy={busy}
          onPick={onRescheduled}
          onClose={() => setRescheduleOpen(false)}
        />
      </Modal>
    </View>
  );
}

function ReschedulePicker({
  propertyId,
  currentSlotId,
  busy,
  onPick,
  onClose,
}: {
  propertyId: string;
  currentSlotId: string;
  busy: boolean;
  onPick: (row: VisitSlotRow) => void;
  onClose: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { property } = useCatalogProperty(propertyId);
  const [days, setDays] = useState<VisitDay[]>([]);
  const [slotsByDay, setSlotsByDay] = useState<
    (dayKey: string) => VisitSlotRow[]
  >(() => () => []);
  const [dayKey, setDayKey] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(true);

  const slots = useMemo(() => slotsByDay(dayKey), [slotsByDay, dayKey]);
  const enabledDates = useMemo(() => new Set(days.map((d) => d.key)), [days]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        try {
          const rawSlots = await listVisitSlots(propertyId);
          if (!active) return;
          const grouped = property
            ? groupVisitSlotsByDay(rawSlots, property)
            : { days: [], slotsForDay: () => [] as VisitSlotRow[] };
          setDays(grouped.days);
          setSlotsByDay(() => grouped.slotsForDay);
          setDayKey(todayKey());
        } catch (err) {
          showFeedback({
            title: 'Erreur',
            message: getErrorMessage(
              err,
              'Impossible de charger les créneaux',
            ),
            type: 'error',
          });
        } finally {
          if (active) setLoadingSlots(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [propertyId, property, showFeedback]),
  );

  const available = slots.filter((s) => s.id !== currentSlotId);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={onClose} accessibilityLabel="Fermer">
          <Ionicons name="close" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Nouveau créneau</Text>
        <View style={styles.spacer} />
      </View>

      {loadingSlots ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : days.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.hint}>Aucun créneau disponible</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <MonthCalendar
            initialMonth={dayKey}
            selected={dayKey}
            onSelectDate={setDayKey}
            enabledDates={enabledDates}
          />
          <View style={styles.slotList}>
            {available.map((row) => (
              <Pressable
                key={row.id}
                style={styles.slotRow}
                disabled={busy}
                onPress={() => onPick(row)}
                accessibilityRole="button"
                accessibilityLabel={`Créneau de ${row.startLabel} à ${row.endLabel}`}
              >
                <Text style={styles.slotText}>
                  {row.startLabel} – {row.endLabel}
                </Text>
                {row.paid && row.priceLabel ? (
                  <Text style={styles.slotPrice}>{row.priceLabel}</Text>
                ) : null}
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.muted}
                />
              </Pressable>
            ))}
            {available.length === 0 ? (
              <Text style={styles.hint}>Aucun autre créneau ce jour-là.</Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  spacer: { width: 40 },
  content: { padding: spacing.md, gap: spacing.md },
  hero: { gap: 6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  location: { fontSize: 14, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  body: { fontSize: 14, color: colors.ink },
  hint: { fontSize: 13, color: colors.muted },
  holdText: { fontSize: 13, fontWeight: '700', color: colors.warning },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 14, color: colors.muted },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.ink },
  contactBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  contactText: { color: colors.surface, fontWeight: '700', fontSize: 14 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
  },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: colors.surface, fontWeight: '800', fontSize: 15 },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerText: { color: colors.danger, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
  missing: { fontSize: 15, color: colors.muted, marginBottom: 10 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  slotList: { gap: 8 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  slotText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  slotPrice: { fontSize: 13, color: colors.muted },
});
