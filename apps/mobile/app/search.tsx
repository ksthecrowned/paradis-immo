import PropertyCard from '@/components/property/card';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { MOCK_PROPERTIES } from '@/lib/mock-properties';
import {
  countActiveFilters,
  filterProperties,
  filtersToParams,
  paramsToFilters,
} from '@/lib/search-filters';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    () => filterProperties(MOCK_PROPERTIES, filters),
    [filters],
  );
  const activeFilterCount = countActiveFilters(filters);
  const showSuggestions = query.trim().length === 0;

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
            placeholderTextColor={colors.muted}
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

        {/* <Pressable
          style={styles.filterButton}
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Filtres"
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={colors.ink}
            style={styles.filterIcon}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable> */}
      </View>

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
          <View style={styles.empty}>
            <Ionicons name="home-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aucun bien trouvé</Text>
            <Text style={styles.emptySubtitle}>
              Essayez un autre quartier ou assouplissez vos filtres.
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable
                style={styles.emptyAction}
                onPress={openFilters}
                accessibilityRole="button"
              >
                <Text style={styles.emptyActionText}>Modifier les filtres</Text>
              </Pressable>
            ) : null}
          </View>
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
  filterButton: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIcon: {
    transform: [{ rotate: '90deg' }],
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.surface,
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
