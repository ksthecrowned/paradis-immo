import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  leaseStatusLabel,
  leaseStatusTone,
  listMockLeases,
  nextDueForLease,
  rentLineStatusLabel,
  type MockLease,
} from '@/lib/mock-leases';
import { getPropertyById } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export default function LeasesListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/leases');
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const data = useMemo(() => listMockLeases(), [tick]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  if (!ready) {
    return <View style={styles.screen} />;
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

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing.lg },
          data.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
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
        renderItem={({ item }) => <LeaseCard lease={item} />}
      />
    </View>
  );
}

function LeaseCard({ lease }: { lease: MockLease }): React.JSX.Element {
  const property = getPropertyById(lease.propertyId);
  const next = nextDueForLease(lease.id);

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/leases/${lease.id}`)}
      accessibilityRole="button"
      accessibilityLabel={property?.title ?? 'Bail'}
    >
      <View style={styles.cardTop}>
        <StatusBadge
          label={leaseStatusLabel(lease.status)}
          tone={leaseStatusTone(lease.status)}
        />
        <Text style={styles.rent}>{formatFcfa(lease.monthlyRent)} / mois</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {property?.title ?? 'Bien'}
      </Text>
      <View style={styles.locationRow}>
        <Ionicons name="location" size={13} color={colors.muted} />
        <Text style={styles.location} numberOfLines={1}>
          {property?.location ?? 'Pointe-Noire'}
        </Text>
      </View>
      <Text style={styles.nextDue}>
        {next
          ? `Prochaine échéance · ${next.label} · ${rentLineStatusLabel(next.status)}`
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
