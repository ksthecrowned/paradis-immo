import { TenantLeaseHero } from '@/components/tenant/TenantLeaseHero';
import { TenantQuickActions } from '@/components/tenant/TenantQuickActions';
import { TenantRentCard } from '@/components/tenant/TenantRentCard';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { formatDueLabel } from '@/lib/format-date-fr';
import { getErrorMessage } from '@/lib/feedback';
import {
  canPayRentLine,
  getLeaseSchedule,
  leaseStatusLabel,
  leaseStatusTone,
  mapScheduleEntry,
  nextPendingDue,
  rentScheduleStatusLabel,
  rentScheduleStatusTone,
  type PublicLease,
  type RentLineView,
} from '@/lib/leases';
import {
  leaseDocTypeLabel,
  listLeaseDocuments,
  listMyDocuments,
  tenantDocTypeLabel,
  type LeaseDocumentItem,
  type TenantDocumentItem,
} from '@/lib/documents';
import { fetchActiveLeaseForProperty } from '@/lib/portfolio';
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

export default function PortfolioRentHubScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const id = String(propertyId ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lease, setLease] = useState<PublicLease | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [schedule, setSchedule] = useState<RentLineView[]>([]);
  const [nextDue, setNextDue] = useState<RentLineView | undefined>();
  const [idDocs, setIdDocs] = useState<TenantDocumentItem[]>([]);
  const [leaseDocs, setLeaseDocs] = useState<LeaseDocumentItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await fetchActiveLeaseForProperty(id);
      if (!active) {
        setLease(null);
        setProperty(null);
        setSchedule([]);
        setNextDue(undefined);
        setIdDocs([]);
        setLeaseDocs([]);
        return;
      }
      const [prop, rawSchedule, mine, contracts] = await Promise.all([
        fetchCatalogProperty(active.propertyId),
        getLeaseSchedule(active.id),
        listMyDocuments().catch(() => [] as TenantDocumentItem[]),
        listLeaseDocuments(active.id).catch(() => [] as LeaseDocumentItem[]),
      ]);
      const lines = rawSchedule.map(mapScheduleEntry);
      setLease(active);
      setProperty(prop);
      setSchedule(lines.slice(0, 6));
      setNextDue(nextPendingDue(lines));
      setIdDocs(mine);
      setLeaseDocs(contracts);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le bail'));
      setLease(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/portfolio/${id}/rent`,
        );
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [id, load]),
  );

  const onPay = async (): Promise<void> => {
    if (!lease || !property || !nextDue) return;
    const qs = new URLSearchParams({
      propertyId: property.id,
      amount: String(nextDue.amount),
      currency: nextDue.currency || 'XAF',
      rentScheduleId: nextDue.id,
      title: `Loyer · ${nextDue.label}`,
    });
    router.push(`/payment/checkout?${qs.toString()}`);
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
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>
          {error ?? 'Aucun bail actif sur ce bien'}
        </Text>
        <Pressable onPress={() => router.replace(`/portfolio/${id}`)}>
          <Text style={styles.link}>Voir l’historique</Text>
        </Pressable>
      </View>
    );
  }

  const contactPhone = property.agentPhone ?? undefined;
  const canPay = nextDue ? canPayRentLine(nextDue.status) : false;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <CircleIconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </CircleIconButton>

        <TenantLeaseHero
          property={property}
          leaseStatus={lease.status}
          agencyName={property.agencyName}
        />

        <Pressable
          style={styles.solvencyLink}
          onPress={() => router.push('/cahier-loyer/solvency')}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.solvencyLinkText}>Demandes de solvabilité</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {nextDue ? (
          <TenantRentCard
            line={nextDue}
            canPay={canPay}
            onPay={() => void onPay()}
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
              key: 'contact',
              label: 'Contacter',
              icon: 'call-outline',
              onPress: () => {
                if (contactPhone) void Linking.openURL(`tel:${contactPhone}`);
              },
              disabled: !contactPhone,
            },
          ]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cahier de loyer</Text>
          {schedule.length === 0 ? (
            <Text style={styles.emptyHint}>Aucune échéance</Text>
          ) : (
            schedule.map((line) => (
              <View key={line.id} style={styles.rowCard}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{line.label}</Text>
                  <Text style={styles.rowMeta}>
                    {formatFcfa(line.amount)} · {formatDueLabel(line.dueDate)}
                  </Text>
                </View>
                <StatusBadge
                  label={rentScheduleStatusLabel(line.status)}
                  tone={rentScheduleStatusTone(line.status)}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes documents</Text>
          {idDocs.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun document pour l’instant</Text>
          ) : (
            idDocs.map((d) => (
              <Pressable
                key={d.id}
                style={styles.rowCard}
                onPress={() => void Linking.openURL(d.url)}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{d.name}</Text>
                  <Text style={styles.rowMeta}>{tenantDocTypeLabel(d.type)}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contrat</Text>
          {leaseDocs.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun contrat pour l’instant</Text>
          ) : (
            leaseDocs.map((d) => (
              <Pressable
                key={d.id}
                style={styles.rowCard}
                onPress={() => void Linking.openURL(d.url)}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{d.name}</Text>
                  <Text style={styles.rowMeta}>{leaseDocTypeLabel(d.type)}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.primary} />
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.leaseMeta}>
            <StatusBadge
              label={leaseStatusLabel(lease.status)}
              tone={leaseStatusTone(lease.status)}
            />
            <Text style={styles.emptyHint}>
              Début {lease.startDate.slice(0, 10)}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.historique}
          onPress={() => router.push(`/portfolio/${id}`)}
        >
          <Text style={styles.historiqueText}>Historique du bien</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
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
    gap: 4,
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
  leaseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoCard: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  solvencyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  solvencyLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  infoBody: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  historique: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
  },
  historiqueText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  missing: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
