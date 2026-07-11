import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import {
  canCreateMaintenance,
  canPayRentLine,
  getMockLease,
  leaseStatusLabel,
  leaseStatusTone,
  listScheduleForLease,
  listTicketsForLease,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  rentLineStatusLabel,
  rentLineStatusTone,
} from '@/lib/mock-leases';
import { getPropertyById } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const leaseId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/leases/${leaseId}`);
        if (active) {
          setReady(ok);
          setTick((n) => n + 1);
        }
      })();
      return () => {
        active = false;
      };
    }, [leaseId]),
  );

  const lease = useMemo(() => getMockLease(leaseId), [leaseId, tick]);
  const property = useMemo(
    () => (lease ? getPropertyById(lease.propertyId) : undefined),
    [lease],
  );
  const agency = useMemo(
    () => (lease ? getAgency(lease.agencyId) : undefined),
    [lease],
  );
  const agent = useMemo(
    () => (lease ? getAgent(lease.agentId) : undefined),
    [lease],
  );
  const schedule = useMemo(
    () => (lease ? listScheduleForLease(lease.id) : []),
    [lease, tick],
  );
  const tickets = useMemo(
    () => (lease ? listTicketsForLease(lease.id) : []),
    [lease, tick],
  );

  if (!ready) {
    return <View style={styles.screen} />;
  }

  if (!lease || !property) {
    return (
      <View style={[styles.screen, styles.centered, { padding: spacing.lg }]}>
        <Text style={styles.missing}>Bail introuvable</Text>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const allowMaintenance = canCreateMaintenance(lease);

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
              Loyer · {formatFcfa(lease.monthlyRent)} / mois
            </Text>
            <Text style={styles.metaLine}>
              Caution · {formatFcfa(lease.deposit)}
            </Text>
            <Text style={styles.metaLine}>
              Début · {lease.startDate}
              {lease.endDate ? ` · Fin · ${lease.endDate}` : ''}
            </Text>
            <Text style={styles.metaLine}>
              {agency?.shortName ?? 'Agence'}
              {agent ? ` · ${agent.name}` : ''}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Échéancier</Text>
          <View style={styles.card}>
            {schedule.map((line, index) => (
              <View
                key={line.id}
                style={[
                  styles.lineRow,
                  index < schedule.length - 1 && styles.lineBorder,
                ]}
              >
                <View style={styles.lineMain}>
                  <Text style={styles.lineTitle}>{line.label}</Text>
                  <Text style={styles.muted}>{formatFcfa(line.amount)}</Text>
                  <StatusBadge
                    label={rentLineStatusLabel(line.status)}
                    tone={rentLineStatusTone(line.status)}
                  />
                </View>
                {canPayRentLine(lease, line) ? (
                  <Pressable
                    style={styles.payBtn}
                    onPress={() =>
                      router.push(`/payment/${line.paymentSessionId}`)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Payer ${line.label}`}
                  >
                    <Text style={styles.payBtnText}>Payer</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Maintenance</Text>
            {allowMaintenance ? (
              <Pressable
                onPress={() =>
                  router.push(`/leases/${lease.id}/maintenance/new`)
                }
                accessibilityRole="button"
              >
                <Text style={styles.link}>Signaler</Text>
              </Pressable>
            ) : null}
          </View>
          {!allowMaintenance ? (
            <Text style={styles.hint}>
              Bail terminé — signalement indisponible
            </Text>
          ) : null}
          <View style={styles.card}>
            {tickets.length === 0 ? (
              <Text style={styles.muted}>Aucun ticket pour l’instant.</Text>
            ) : (
              tickets.map((ticket, index) => (
                <View
                  key={ticket.id}
                  style={[
                    styles.ticketRow,
                    index < tickets.length - 1 && styles.lineBorder,
                  ]}
                >
                  <Text style={styles.lineTitle}>{ticket.title}</Text>
                  <StatusBadge
                    label={maintenanceStatusLabel(ticket.status)}
                    tone={maintenanceStatusTone(ticket.status)}
                  />
                </View>
              ))
            )}
          </View>
          {allowMaintenance ? (
            <Pressable
              style={styles.primaryCta}
              onPress={() =>
                router.push(`/leases/${lease.id}/maintenance/new`)
              }
              accessibilityRole="button"
            >
              <Text style={styles.primaryCtaText}>Signaler un problème</Text>
            </Pressable>
          ) : null}
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
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
  ticketRow: {
    gap: 8,
    paddingVertical: 8,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  primaryCta: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
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
