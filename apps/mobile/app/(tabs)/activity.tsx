import { StatusBadge } from '@/components/ui/StatusBadge';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  ACTIVITY_TABS,
  listMockActivity,
  type ActivityItem,
  type ActivitySegment,
} from '@/lib/mock-activity';
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

const EMPTY: Record<
  ActivitySegment,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  visits: {
    title: 'Aucune visite',
    subtitle: 'Réservez une visite depuis la fiche d’un bien.',
    icon: 'calendar-outline',
  },
  bookings: {
    title: 'Aucune réservation',
    subtitle: 'Vos locations journalières apparaîtront ici.',
    icon: 'key-outline',
  },
  sales: {
    title: 'Aucun achat',
    subtitle: 'Vos demandes d’achat apparaîtront ici.',
    icon: 'home-outline',
  },
  payments: {
    title: 'Aucun paiement',
    subtitle: 'Les paiements de visite et de séjour s’affichent ici.',
    icon: 'card-outline',
  },
  rents: {
    title: 'Aucun loyer',
    subtitle: 'Le suivi de vos loyers apparaîtra ici.',
    icon: 'wallet-outline',
  },
};

export default function ActivityScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<ActivitySegment>('visits');
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/(tabs)/activity');
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const data = useMemo(
    () => listMockActivity(segment),
    [segment, tick],
  );
  const emptyCopy = EMPTY[segment];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((n) => n + 1);
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  const onItemPress = (item: ActivityItem): void => {
    router.push(`/property/${item.propertyId}`);
  };

  if (!ready) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Mon activité</Text>
        <Text style={styles.subtitle}>
          Visites, réservations, achats et paiements
        </Text>
        <SegmentTabs
          tabs={ACTIVITY_TABS}
          value={segment}
          onChange={(key) => setSegment(key as ActivitySegment)}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
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
              <Ionicons
                name={emptyCopy.icon}
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={styles.emptySubtitle}>{emptyCopy.subtitle}</Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.push('/search')}
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaText}>Explorer</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onItemPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.statusLabel}`}
          >
            <View style={styles.cardTop}>
              <StatusBadge label={item.statusLabel} tone={item.tone} />
              <Text style={styles.meta} numberOfLines={1}>
                {item.meta}
              </Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={13} color={colors.muted} />
              <Text style={styles.location} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    marginBottom: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 16,
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
    color: colors.muted,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
});
