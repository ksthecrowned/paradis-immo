import { AgentRow } from '@/components/agency/AgentRow';
import { StarRating } from '@/components/agency/StarRating';
import PropertyCard, { PropertyCardSkeleton } from '@/components/property/card';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { colors, radii, spacing } from '@/constants/theme';
import {
  fetchAgency,
  type Agency,
  type Agent,
} from '@/lib/agencies';
import { fetchCatalogProperties } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import { listAgencyReviews } from '@/lib/mock-agency-reviews';
import type { Property } from '@/types/property';
import { Ionicons, Octicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { key: 'properties', label: 'Biens' },
  { key: 'agents', label: 'Agents' },
  { key: 'reviews', label: 'Avis' },
] as const;

type Segment = (typeof TABS)[number]['key'];

export default function AgencyHubScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agencyId = String(id ?? '');

  const [agency, setAgency] = useState<Agency | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>('properties');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agencyId) {
        setError('Agence introuvable');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [detail, props] = await Promise.all([
          fetchAgency(agencyId),
          fetchCatalogProperties({ organizationId: agencyId }),
        ]);
        if (cancelled) return;
        setAgency(detail);
        setAgents(detail.agents);
        setAllProperties(props);
      } catch (err) {
        if (!cancelled) {
          setAgency(null);
          setError(getErrorMessage(err, 'Impossible de charger l’agence'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const reviews = useMemo(
    () => (agency ? listAgencyReviews(agency.id) : []),
    [agency],
  );
  const selectedAgent = selectedAgentId
    ? agents.find((a) => a.id === selectedAgentId)
    : undefined;

  const properties = useMemo(() => {
    if (selectedAgentId) {
      return allProperties.filter((p) => p.agentId === selectedAgentId);
    }
    return allProperties;
  }, [allProperties, selectedAgentId]);

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((key) => (
            <View key={key} style={styles.cardPad}>
              <PropertyCardSkeleton />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!agency) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>{error ?? 'Agence introuvable'}</Text>
        <Pressable
          style={styles.missingBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const handleCallAgency = (): void => {
    if (!agency.phone) return;
    void Linking.openURL(`tel:${agency.phone.replace(/\s/g, '')}`);
  };

  const listHeader = (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <LinearGradient
          colors={[`${agency.logoColor}33`, colors.bg]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topBar}>
          <CircleIconButton
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </CircleIconButton>
          <CircleIconButton
            onPress={handleCallAgency}
            accessibilityLabel="Appeler l’agence"
          >
            <Ionicons name="call-outline" size={22} color={colors.ink} />
          </CircleIconButton>
        </View>

        <View style={styles.identityCard}>
          <View style={styles.identityTop}>
            <View style={styles.identityText}>
              <Text style={styles.name}>{agency.name}</Text>
              <View style={styles.ratingRow}>
                <StarRating rating={agency.rating} size={14} />
                <Text style={styles.ratingValue}>
                  {agency.rating.toFixed(1)}
                </Text>
                <Text style={styles.ratingMeta}>
                  · {agency.reviewCount} avis
                </Text>
              </View>
              <View style={styles.badgeRow}>
                {agency.isOfficial ? (
                  <View style={styles.officialBadge}>
                    <Octicons name="verified" size={12} color={colors.primary} />
                  </View>
                ) : null}
                {agency.rating >= 4.8 ? (
                  <View style={styles.topBadge}>
                    <Ionicons name="star" size={12} color="#B45309" />
                    <Text style={styles.topBadgeText}>Top</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={[styles.logo, { backgroundColor: agency.logoColor }]}>
              <Text style={styles.logoText}>{agency.shortName.slice(0, 1)}</Text>
            </View>
          </View>

          <View style={styles.infoBlock}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
              <Text style={styles.infoText}>
                {agency.address}, {agency.city}
              </Text>
            </View>
            <Pressable
              style={styles.infoRow}
              onPress={handleCallAgency}
              accessibilityRole="button"
            >
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, styles.infoLink]}>
                {agency.phone}
              </Text>
            </Pressable>
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
              <Text style={styles.infoText}>{agency.tagline}</Text>
            </View>
          </View>

          <View style={styles.dealBlock}>
            <View style={styles.dealHeader}>
              <Text style={styles.dealLabel}>Succès transactions</Text>
              <Text style={styles.dealValue}>{agency.dealSuccessPercent}%</Text>
            </View>
            <View style={styles.dealTrack}>
              <View
                style={[
                  styles.dealFill,
                  {
                    width: `${agency.dealSuccessPercent}%`,
                    backgroundColor: agency.logoColor,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentTabs
          tabs={[...TABS]}
          value={segment}
          onChange={(key) => {
            setSegment(key as Segment);
            if (key !== 'properties') setSelectedAgentId(null);
          }}
        />
      </View>

      {selectedAgentId && selectedAgent && segment === 'properties' ? (
        <View style={styles.filterBar}>
          <Text style={styles.filterLabel} numberOfLines={1}>
            Agent : {selectedAgent.displayName}
          </Text>
          <Pressable
            onPress={() => setSelectedAgentId(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Effacer le filtre agent"
          >
            <Ionicons name="close-circle" size={22} color={colors.primary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  if (segment === 'properties') {
    return (
      <View style={styles.screen}>
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.lg },
            properties.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="home-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Aucun bien</Text>
              <Text style={styles.emptySubtitle}>
                {selectedAgentId
                  ? 'Cet agent n’a pas d’annonce pour le moment.'
                  : 'Aucun bien pour cette agence'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardPad}>
              <PropertyCard
                property={item}
                onPress={() => router.push(`/property/${item.id}`)}
              />
            </View>
          )}
        />
      </View>
    );
  }

  if (segment === 'agents') {
    return (
      <View style={styles.screen}>
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.lg },
            agents.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.agentSep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun agent</Text>
            </View>
          }
          renderItem={({ item }) => {
            const listingCount = allProperties.filter(
              (p) => p.agentId === item.id,
            ).length;
            return (
              <View style={styles.agentCard}>
                <AgentRow
                  agentId={item.id}
                  fallbackName={item.displayName}
                  fallbackPhone={item.phone}
                  listingCount={listingCount}
                  showListingCount
                  showPhone
                  onPress={() => {
                    setSelectedAgentId(item.id);
                    setSegment('properties');
                  }}
                />
                <Text style={styles.agentHint}>Voir ses biens</Text>
              </View>
            );
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.lg },
          reviews.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={styles.agentSep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun avis</Text>
            <Text style={styles.emptySubtitle}>
              Aucun avis pour le moment.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <View style={styles.reviewAvatar}>
                <Text style={styles.reviewAvatarText}>
                  {item.authorName.slice(0, 1)}
                </Text>
              </View>
              <View style={styles.reviewBody}>
                <Text style={styles.reviewAuthor}>{item.authorName}</Text>
                <Text style={styles.reviewProperty} numberOfLines={1}>
                  {item.propertyTitle}
                </Text>
              </View>
              <Text style={styles.reviewDate}>{item.createdLabel}</Text>
            </View>
            <Text style={styles.reviewText} numberOfLines={3}>
              {item.body}
            </Text>
            <StarRating rating={item.rating} size={13} />
          </View>
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
  hero: {
    paddingBottom: spacing.sm,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identityCard: {
    marginHorizontal: spacing.md,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  identityTop: {
    flexDirection: 'row',
    gap: 12,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  ratingMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  officialBadge: {
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    padding: 4,
  },
  topBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.warningSoft,
  },
  topBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.surface,
  },
  infoBlock: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
  },
  infoLink: {
    fontWeight: '700',
    color: colors.primary,
  },
  dealBlock: {
    gap: 8,
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  dealValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  dealTrack: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
  },
  dealFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  tabsWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  filterBar: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  listContent: {
    flexGrow: 1,
  },
  listEmpty: {
    flexGrow: 1,
  },
  cardPad: {
    paddingHorizontal: spacing.md,
  },
  skeletonList: {
    gap: spacing.md,
    paddingHorizontal: 0,
  },
  separator: {
    height: spacing.md,
  },
  agentSep: {
    height: 10,
  },
  agentCard: {
    marginHorizontal: spacing.md,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  agentHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    paddingLeft: 64,
    marginTop: -4,
    marginBottom: 4,
  },
  reviewCard: {
    marginHorizontal: spacing.md,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  reviewBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  reviewProperty: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  reviewDate: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
  },
  reviewText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 8,
    paddingHorizontal: spacing.md,
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
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  missingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
