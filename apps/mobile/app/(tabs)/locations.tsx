import { ProspectPipelineList } from '@/components/tenant/ProspectPipelineList';
import { TenantLeaseHero } from '@/components/tenant/TenantLeaseHero';
import { TenantQuickActions } from '@/components/tenant/TenantQuickActions';
import { TenantRentCard } from '@/components/tenant/TenantRentCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import {
  listProspectPipeline,
  type ActivityItem,
} from '@/lib/mock-activity';
import {
  canCreateMaintenance,
  canPayRentLine,
  getPrimaryActiveLease,
  listActiveLeases,
  listMockLeases,
  listScheduleForLease,
  listTicketsForLease,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  nextDueForLease,
  rentLineStatusLabel,
  rentLineStatusTone,
} from '@/lib/mock-leases';
import { getPropertyById } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
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

export default function LocationsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/(tabs)/locations');
        if (active) {
          setReady(ok);
          setTick((n) => n + 1);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const activeLeases = useMemo(() => listActiveLeases(), [tick]);
  const lease =
    activeLeases.find((item) => item.id === selectedId) ??
    getPrimaryActiveLease();
  const property = lease ? getPropertyById(lease.propertyId) : undefined;
  const agency = lease ? getAgency(lease.agencyId) : undefined;
  const agent = lease ? getAgent(lease.agentId) : undefined;
  const nextDue = lease ? nextDueForLease(lease.id) : undefined;
  const schedule = lease ? listScheduleForLease(lease.id).slice(0, 3) : [];
  const openTickets = lease
    ? listTicketsForLease(lease.id).filter(
        (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS',
      )
    : [];
  const hasTerminated = useMemo(
    () => listMockLeases().some((l) => l.status === 'TERMINATED'),
    [tick],
  );
  const prospectSections = useMemo(() => listProspectPipeline(), [tick]);

  const onProspectPress = (item: ActivityItem): void => {
    if (item.segment === 'rents' && item.leaseId) {
      router.push(`/leases/${item.leaseId}`);
      return;
    }
    router.push(`/property/${item.propertyId}`);
  };

  const contactPhone = agent?.phone ?? agency?.phone;
  const onContact = (): void => {
    if (!contactPhone) return;
    void Linking.openURL(`tel:${contactPhone}`);
  };

  if (!ready) {
    return <View style={styles.screen} />;
  }

  if (!lease || !property) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Votre espace location</Text>
          <Text style={styles.subtitle}>
            Suivez vos visites et démarches avant d’emménager.
          </Text>

          <ProspectPipelineList
            sections={prospectSections}
            onItemPress={onProspectPress}
          />

          <View style={styles.ctaRow}>
            <Pressable
              style={styles.primaryCta}
              onPress={() => router.push('/(tabs)/discover')}
              accessibilityRole="button"
            >
              <Text style={styles.primaryCtaText}>Explorer</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => router.push('/activity')}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryCtaText}>Voir l’historique</Text>
            </Pressable>
          </View>

          {hasTerminated ? (
            <Pressable
              onPress={() => router.push('/leases')}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Anciens baux</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const canPay = nextDue ? canPayRentLine(lease, nextDue) : false;
  const allowMaintenance = canCreateMaintenance(lease);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Locations</Text>
        <Text style={styles.subtitle}>Bail, loyer et incidents</Text>

        {activeLeases.length > 1 ? (
          <View style={styles.chipRow}>
            {activeLeases.map((item) => {
              const selected = item.id === lease.id;
              const p = getPropertyById(item.propertyId);
              return (
                <Pressable
                  key={item.id}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setSelectedId(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {p?.title ?? item.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <TenantLeaseHero
          property={property}
          lease={lease}
          agencyName={agency?.shortName ?? agency?.name}
        />

        {nextDue ? (
          <TenantRentCard
            line={nextDue}
            canPay={canPay}
            onPay={() => {
              if (nextDue.paymentSessionId) {
                router.push(`/payment/${nextDue.paymentSessionId}`);
              }
            }}
          />
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Aucun loyer à venir</Text>
            <Text style={styles.infoBody}>
              Votre échéancier est à jour pour le moment.
            </Text>
          </View>
        )}

        <TenantQuickActions
          actions={[
            {
              key: 'lease',
              label: 'Voir le bail',
              icon: 'document-text-outline',
              onPress: () => router.push(`/leases/${lease.id}`),
            },
            {
              key: 'maintenance',
              label: 'Signalement',
              icon: 'construct-outline',
              onPress: () =>
                router.push(`/leases/${lease.id}/maintenance/new`),
              disabled: !allowMaintenance,
            },
            {
              key: 'contact',
              label: 'Contacter',
              icon: 'call-outline',
              onPress: onContact,
              disabled: !contactPhone,
            },
          ]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Échéances</Text>
          {schedule.map((line) => (
            <View key={line.id} style={styles.rowCard}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{line.label}</Text>
                <Text style={styles.rowMeta}>
                  {formatFcfa(line.amount)} · {line.dueDate}
                </Text>
              </View>
              <StatusBadge
                label={rentLineStatusLabel(line.status)}
                tone={rentLineStatusTone(line.status)}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incidents</Text>
          {openTickets.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun incident ouvert</Text>
          ) : (
            openTickets.map((ticket) => (
              <View key={ticket.id} style={styles.rowCard}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{ticket.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {ticket.description}
                  </Text>
                </View>
                <StatusBadge
                  label={maintenanceStatusLabel(ticket.status)}
                  tone={maintenanceStatusTone(ticket.status)}
                />
              </View>
            ))
          )}
        </View>

        <Pressable
          style={styles.historyLink}
          onPress={() => router.push('/activity')}
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.link}>Mon historique</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: -8,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.surface,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  infoCard: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  infoBody: {
    fontSize: 13,
    color: colors.muted,
  },
  ctaRow: {
    gap: 10,
    marginTop: 8,
  },
  primaryCta: {
    minHeight: 48,
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
  secondaryCta: {
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
});
