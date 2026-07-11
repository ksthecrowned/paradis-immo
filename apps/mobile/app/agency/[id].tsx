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
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
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
  const selectedAgent = selectedAgentId
    ? getAgent(selectedAgentId)
    : undefined;

  const properties = useMemo(() => {
    if (!agency) return [];
    if (selectedAgentId) return listPropertiesByAgent(selectedAgentId);
    return listPropertiesByAgency(agency.id);
  }, [agency, selectedAgentId]);

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

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
      </View>

      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: agency.logoColor }]}>
          <Text style={styles.logoText}>{agency.shortName.slice(0, 1)}</Text>
        </View>
        <Text style={styles.name}>{agency.name}</Text>
        <Text style={styles.meta}>
          {agency.city} · {listPropertiesByAgency(agency.id).length} biens
        </Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentTabs
          tabs={[...TABS]}
          value={segment}
          onChange={(key) => setSegment(key as Segment)}
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

      {segment === 'properties' ? (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.lg },
            properties.length === 0 && styles.listEmpty,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucun bien</Text>
              <Text style={styles.emptySubtitle}>
                {selectedAgentId
                  ? 'Cet agent n’a pas d’annonce pour le moment.'
                  : 'Cette agence n’a pas d’annonce pour le moment.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() => router.push(`/property/${item.id}`)}
            />
          )}
        />
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(item) => item.id}
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
                onPress={() => {
                  setSelectedAgentId(item.id);
                  setSegment('properties');
                }}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.surface,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
  },
  meta: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  tabsWrap: {
    paddingHorizontal: spacing.md,
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
    paddingHorizontal: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  agentSep: {
    height: 8,
  },
  agentCard: {
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 8,
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
