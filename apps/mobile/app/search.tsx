import PropertyCard, { PropertyCardSkeleton } from '@/components/property/card';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { getStoredUser } from '@/lib/auth';
import { fetchCatalogProperties } from '@/lib/catalog';
import { PROPERTY_CATEGORIES } from '@/lib/categories';
import { getErrorMessage } from '@/lib/feedback';
import {
  listCities,
  listQuartiersForCity,
} from '@/lib/locations';
import {
  paramsAreBareSearch,
  seekerPrefsToSearchFilters,
} from '@/lib/seeker-setup';
import {
  countActiveFilters,
  DEFAULT_SEARCH_FILTERS,
  filterProperties,
  filtersToParams,
  paramsToFilters,
} from '@/lib/search-filters';
import { syncStoredUserFromApi } from '@/lib/users';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUGGESTIONS = [
  'Loandjili',
  'Centre-ville',
  'Tié-Tié',
  'Villa',
  'Appartement',
  'Terrain',
];

export default function SearchScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const inputRef = useRef<TextInput>(null);

  const initial = useMemo(() => paramsToFilters(params), [params]);
  const [query, setQuery] = useState(initial.q);
  const [catalog, setCatalog] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seededFromPrefs = useRef(false);

  useEffect(() => {
    if (seededFromPrefs.current) return;
    if (!paramsAreBareSearch(params)) return;
    seededFromPrefs.current = true;

    let active = true;
    void (async () => {
      try {
        let me = await getStoredUser();
        const needsSync =
          !me?.seekerSetupCompletedAt &&
          !(me?.preferredQuartierIds?.length) &&
          me?.seekerIntent == null;
        if (needsSync) {
          me = (await syncStoredUserFromApi()) ?? me;
        }
        if (!active || !me) return;

        const hasPrefs =
          me.seekerIntent != null ||
          me.budgetMinXaf != null ||
          me.budgetMaxXaf != null ||
          (me.preferredQuartierIds?.length ?? 0) > 0;
        if (!hasPrefs) return;

        let resolveQuartier:
          | ((id: string) => {
              id: string;
              name: string;
              cityId: string;
              cityName: string;
            } | null)
          | undefined;

        const firstQuartierId = me.preferredQuartierIds?.[0];
        if (firstQuartierId) {
          try {
            const cities = await listCities('CG');
            const bzv =
              cities.find((c) => c.name.toLowerCase() === 'brazzaville') ??
              cities[0];
            if (bzv) {
              const rows = await listQuartiersForCity(bzv.id);
              const byId = new Map(rows.map((q) => [q.id, q]));
              resolveQuartier = (id) => {
                const q = byId.get(id);
                if (!q) return null;
                return {
                  id: q.id,
                  name: q.name,
                  cityId: bzv.id,
                  cityName: bzv.name,
                };
              };
            }
          } catch {
            // Seed without quartier name if locations fail.
          }
        }

        if (!active) return;
        const seeded = seekerPrefsToSearchFilters(
          {
            seekerIntent: me.seekerIntent ?? null,
            seekerExperience: me.seekerExperience ?? null,
            budgetMinXaf: me.budgetMinXaf ?? null,
            budgetMaxXaf: me.budgetMaxXaf ?? null,
            preferredQuartierIds: me.preferredQuartierIds ?? [],
          },
          DEFAULT_SEARCH_FILTERS,
          { resolveQuartier },
        );
        const next = filtersToParams(seeded);
        if (Object.keys(next).length > 0) {
          router.setParams(next);
        }
      } catch {
        // Ignore seed failures — search still works with defaults.
      }
    })();

    return () => {
      active = false;
    };
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const rows = await fetchCatalogProperties({ limit: 50 });
          if (active) setCatalog(rows);
        } catch (err) {
          if (active) {
            setError(getErrorMessage(err, 'Impossible de charger les biens'));
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    setQuery(initial.q);
  }, [initial.q]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const filters = useMemo(
    () => ({ ...initial, q: query }),
    [initial, query],
  );
  const results = useMemo(
    () => filterProperties(catalog, filters),
    [catalog, filters],
  );
  const activeFilterCount = countActiveFilters(filters);
  const showSuggestions = query.trim().length === 0 && activeFilterCount === 0;

  const categorySummary = useMemo(() => {
    if (filters.categories.length === 0) return null;
    if (filters.categories.length === 1) {
      return (
        PROPERTY_CATEGORIES.find((c) => c.key === filters.categories[0])
          ?.label ?? filters.categories[0]
      );
    }
    return `${filters.categories.length} types`;
  }, [filters.categories]);

  const modeSummary =
    filters.mode === 'SALE'
      ? 'Vente'
      : filters.mode === 'RENT_SHORT'
        ? 'Journalier'
        : null;

  const openFilters = (): void => {
    router.push({
      pathname: '/filters',
      params: filtersToParams(filters),
    });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topBar}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>

        <View style={styles.searchField}>
          <Ionicons name="search-outline" size={22} color={colors.muted} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Quartier, type de bien…"
            placeholderTextColor={colors.muted + "20"}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={true}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
            >
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersBarScroll}
        contentContainerStyle={styles.filtersBar}
      >
        <Pressable
          style={[
            styles.filterChip,
            activeFilterCount > 0 && styles.filterChipActive,
          ]}
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Filtres"
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeFilterCount > 0 ? colors.onPrimary : colors.ink}
            style={styles.filterIcon}
          />
          <Text
            style={[
              styles.filterChipText,
              activeFilterCount > 0 && styles.filterChipTextActive,
            ]}
          >
            Filtres
          </Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>

        {filters.cityName ? (
          <Pressable
            style={styles.activeChip}
            onPress={openFilters}
            accessibilityRole="button"
          >
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.activeChipText} numberOfLines={1}>
              {filters.quartierName
                ? `${filters.quartierName}, ${filters.cityName}`
                : filters.cityName}
            </Text>
          </Pressable>
        ) : null}

        {categorySummary ? (
          <Pressable
            style={styles.activeChip}
            onPress={openFilters}
            accessibilityRole="button"
          >
            <Text style={styles.activeChipText} numberOfLines={1}>
              {categorySummary}
            </Text>
          </Pressable>
        ) : null}

        {modeSummary ? (
          <Pressable
            style={styles.activeChip}
            onPress={openFilters}
            accessibilityRole="button"
          >
            <Text style={styles.activeChipText}>{modeSummary}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {showSuggestions ? (
        <View style={styles.suggestionsBlock}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionRow}
          >
            {SUGGESTIONS.map((item) => (
              <Pressable
                key={item}
                style={styles.suggestionChip}
                onPress={() => setQuery(item)}
                accessibilityRole="button"
                accessibilityLabel={`Rechercher ${item}`}
              >
                <Ionicons name="search-outline" size={14} color={colors.muted} />
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.lg },
          results.length === 0 && styles.listEmptyContent,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          !showSuggestions ? (
            <Text style={styles.resultCount}>
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </Text>
          ) : (
            <Text style={styles.sectionLabel}>Biens à proximité</Text>
          )
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2, 3].map((key) => (
                <PropertyCardSkeleton key={key} variant="compact" />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="home-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyTitle}>
                {error ? 'Chargement impossible' : 'Aucun bien trouvé'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error ??
                  'Essayez un autre quartier ou assouplissez vos filtres.'}
              </Text>
              {activeFilterCount > 0 && !error ? (
                <Pressable
                  style={styles.emptyAction}
                  onPress={openFilters}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyActionText}>Modifier les filtres</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => (
          <PropertyCard
            property={item}
            variant="compact"
            onPress={() => router.push(`/property/${item.id}`)}
          />
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchField: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    paddingVertical: 0,
  },
  filtersBarScroll: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  filterIcon: {
    transform: [{ rotate: '90deg' }],
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.onPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  activeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  suggestionsBlock: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  suggestionsLabel: {
    paddingHorizontal: spacing.md,
  },
  suggestionsScroll: {
    flexGrow: 0,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  listEmptyContent: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  resultCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingTop: 48,
  },
  skeletonList: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
