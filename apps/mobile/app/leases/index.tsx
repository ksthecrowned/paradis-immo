import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import {
  getLeaseSchedule,
  leaseStatusLabel,
  leaseStatusTone,
  listMyLeases,
  mapScheduleEntry,
  nextPendingDue,
  rentScheduleStatusLabel,
  type PublicLease,
  type RentLineView,
} from '@/lib/leases';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatFcfa(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

type LeaseListRow = {
  lease: PublicLease;
  property: Property | null;
  next: RentLineView | undefined;
};

export default function LeasesListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<LeaseListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const leases = await listMyLeases();
      const next: LeaseListRow[] = await Promise.all(
        leases.map(async (lease) => {
          const [property, schedule] = await Promise.all([
            fetchCatalogProperty(lease.propertyId).catch(() => null),
            getLeaseSchedule(lease.id)
              .then((raw) => nextPendingDue(raw.map(mapScheduleEntry)))
              .catch(() => undefined),
          ]);
          return { lease, property, next: schedule };
        }),
      );
      setRows(next);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger vos baux'));
      setRows([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/leases');
        if (!active) return;
        setReady(ok);
        if (!ok) return;
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Mes locations</Text>
        <View style={styles.spacer} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void onRefresh()} accessibilityRole="button">
            <Text style={styles.errorRetry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.lease.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing.lg },
          rows.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="key-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Aucun bail</Text>
            <Text style={styles.emptySubtitle}>
              Vos locations longue durée apparaîtront ici.
            </Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.replace('/(tabs)')}
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaText}>Explorer</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <LeaseCard row={item} />}
      />
    </View>
  );
}

function LeaseCard({ row }: { row: LeaseListRow }): React.JSX.Element {
  const { lease, property, next } = row;
  const title = property?.title ?? 'Bien';
  const location = property?.location ?? property?.cityName ?? 'Pointe-Noire';

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/leases/${lease.id}`)}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.cardTop}>
        <StatusBadge
          label={leaseStatusLabel(lease.status)}
          tone={leaseStatusTone(lease.status)}
        />
        <Text style={styles.rent}>
          {formatFcfa(lease.monthlyRent)} / mois
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.locationRow}>
        <Ionicons name="location" size={13} color={colors.muted} />
        <Text style={styles.location} numberOfLines={1}>
          {location}
        </Text>
      </View>
      <Text style={styles.nextDue}>
        {next
          ? `Prochaine échéance · ${next.label} · ${rentScheduleStatusLabel(next.status)}`
          : 'Aucune échéance'}
      </Text>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: {
    width: 44,
  },
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  errorRetry: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rent: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  nextDue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
});
