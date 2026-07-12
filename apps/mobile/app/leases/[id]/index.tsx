import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { formatDateFr, formatDueLabel } from '@/lib/format-date-fr';
import { getErrorMessage } from '@/lib/feedback';
import {
  canPayRentLine,
  getLeaseSchedule,
  leaseStatusLabel,
  leaseStatusTone,
  listMyLeases,
  mapScheduleEntry,
  rentScheduleStatusLabel,
  rentScheduleStatusTone,
  type PublicLease,
  type RentLineView,
} from '@/lib/leases';
import { initiatePayment } from '@/lib/payments';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export default function LeaseDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leaseId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [lease, setLease] = useState<PublicLease | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [schedule, setSchedule] = useState<RentLineView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const leases = await listMyLeases();
      const found = leases.find((l) => l.id === leaseId) ?? null;
      setLease(found);
      if (!found) {
        setProperty(null);
        setSchedule([]);
        return;
      }
      const [prop, raw] = await Promise.all([
        fetchCatalogProperty(found.propertyId),
        getLeaseSchedule(found.id),
      ]);
      setProperty(prop);
      setSchedule(raw.map(mapScheduleEntry));
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le bail'));
      setLease(null);
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/leases/${leaseId}`);
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [leaseId, load]),
  );

  const onPay = async (line: RentLineView): Promise<void> => {
    if (!lease || !property) return;
    setPayingId(line.id);
    try {
      const payment = await initiatePayment({
        amount: line.amount,
        currency: line.currency || 'XAF',
        method: 'CASH',
        idempotencyKey: `rent-${line.id}-${Date.now()}`,
      });
      const total = Number(payment.amount);
      const debt = payment.messagingDebtXaf ?? 0;
      const qs = new URLSearchParams({
        propertyId: property.id,
        amount: String(total),
        rentScheduleId: line.id,
        title: `Loyer · ${line.label}`,
      });
      if (debt > 0) qs.set('messagingDebtXaf', String(debt));
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

  if (error || !lease || !property) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>{error ?? 'Bail introuvable'}</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const phone = property.agentPhone;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Mon bail</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bail</Text>
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/property/${property.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.rowBetween}>
              <StatusBadge
                label={leaseStatusLabel(lease.status)}
                tone={leaseStatusTone(lease.status)}
              />
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
            <Text style={styles.cardTitle}>{property.title}</Text>
            <Text style={styles.muted}>{property.location}</Text>
            <Text style={styles.metaLine}>
              Loyer · {formatFcfa(Number(lease.monthlyRent))} / mois
            </Text>
            <Text style={styles.metaLine}>
              Caution · {formatFcfa(Number(lease.deposit))}
            </Text>
            <Text style={styles.metaLine}>
              Début · {formatDateFr(lease.startDate)}
              {lease.endDate
                ? ` · Fin · ${formatDateFr(lease.endDate)}`
                : ''}
            </Text>
            {property.agencyName ? (
              <Text style={styles.metaLine}>
                {property.agencyName}
                {property.agentName ? ` · ${property.agentName}` : ''}
              </Text>
            ) : null}
          </Pressable>
          {phone ? (
            <Pressable
              style={styles.contactBtn}
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            >
              <Text style={styles.contactText}>Contacter l’agent</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Échéancier</Text>
          <View style={styles.card}>
            {schedule.length === 0 ? (
              <Text style={styles.muted}>Aucune échéance</Text>
            ) : (
              schedule.map((line, index) => (
                <View
                  key={line.id}
                  style={[
                    styles.lineRow,
                    index < schedule.length - 1 && styles.lineBorder,
                  ]}
                >
                  <View style={styles.lineMain}>
                    <Text style={styles.lineTitle}>{line.label}</Text>
                    <Text style={styles.muted}>
                      {formatFcfa(line.amount)} · {formatDueLabel(line.dueDate)}
                    </Text>
                    <StatusBadge
                      label={rentScheduleStatusLabel(line.status)}
                      tone={rentScheduleStatusTone(line.status)}
                    />
                  </View>
                  {canPayRentLine(line.status) ? (
                    <Pressable
                      style={styles.payBtn}
                      onPress={() => void onPay(line)}
                      disabled={payingId === line.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Payer ${line.label}`}
                    >
                      <Text style={styles.payBtnText}>
                        {payingId === line.id ? '…' : 'Payer'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 44 },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  muted: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  metaLine: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  lineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineMain: {
    flex: 1,
    gap: 6,
  },
  lineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  payBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  contactBtn: {
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  missing: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 12,
  },
  backLink: {
    padding: 12,
  },
  backLinkText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
