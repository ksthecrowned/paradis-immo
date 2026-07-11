import PropertyCard from '@/components/property/card';
import { AgentRow } from '@/components/agency/AgentRow';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { SegmentTabs } from '@/components/ui/SegmentTabs';
import { colors, radii, spacing } from '@/constants/theme';
import {
  getAgency,
  getAgent,
  listAgentsByAgency,
} from '@/lib/mock-agencies';
import {
  listPropertiesByAgency,
  listPropertiesByAgent,
} from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
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
] as const;

type Segment = (typeof TABS)[number]['key'];

export default function AgencyHubScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const agencyId = String(id ?? '');
  const agency = useMemo(() => getAgency(agencyId), [agencyId]);

  const [segment, setSegment] = useState<Segment>('properties');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const agents = useMemo(
    () => (agency ? listAgentsByAgency(agency.id) : []),
    [agency],
  );
  const allProperties = useMemo(
    () => (agency ? listPropertiesByAgency(agency.id) : []),
    [agency],
  );
  const selectedAgent = selectedAgentId
    ? getAgent(selectedAgentId)
    : undefined;

  const properties = useMemo(() => {
    if (!agency) return [];
    if (selectedAgentId) return listPropertiesByAgent(selectedAgentId);
    return allProperties;
  }, [agency, selectedAgentId, allProperties]);

  if (!agency) {
    return (
      <View style={[styles.screen, styles.missing, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>Agence introuvable</Text>
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

        <View style={styles.header}>
          <View style={[styles.logo, { backgroundColor: agency.logoColor }]}>
            <Text style={styles.logoText}>{agency.shortName.slice(0, 1)}</Text>
          </View>
          <Text style={styles.name}>{agency.name}</Text>
          <Text style={styles.tagline}>{agency.tagline}</Text>
          {agency.verified ? (
            <View style={styles.verifiedChip}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text style={styles.verifiedText}>Agence vérifiée</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{allProperties.length}</Text>
            <Text style={styles.statLabel}>Biens</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agents.length}</Text>
            <Text style={styles.statLabel}>Agents</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{agency.foundedYear}</Text>
            <Text style={styles.statLabel}>Depuis</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              {agency.address}, {agency.city}
            </Text>
          </View>
          <Pressable
            style={styles.infoRow}
            onPress={handleCallAgency}
            accessibilityRole="button"
            accessibilityLabel="Appeler l’agence"
          >
            <Ionicons name="call-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, styles.infoLink]}>{agency.phone}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentTabs
          tabs={[...TABS]}
          value={segment}
          onChange={(key) => {
            setSegment(key as Segment);
            if (key === 'agents') setSelectedAgentId(null);
          }}
        />
      </View>

      {selectedAgentId && selectedAgent ? (
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
                  : 'Cette agence n’a pas d’annonce pour le moment.'}
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
        renderItem={({ item }) => (
          <View style={styles.agentCard}>
            <AgentRow
              agentId={item.id}
              showListingCount
              showPhone
              onPress={() => {
                setSelectedAgentId(item.id);
                setSegment('properties');
              }}
            />
            <Text style={styles.agentHint}>Voir ses biens</Text>
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
    paddingBottom: spacing.md,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.surface,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  verifiedChip: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: '#DCFCE7',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  statsRow: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  infoCard: {
    marginHorizontal: spacing.md,
    gap: 10,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
  },
  infoLink: {
    fontWeight: '700',
    color: colors.primary,
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
