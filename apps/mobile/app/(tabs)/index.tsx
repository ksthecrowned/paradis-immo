import { HomeAgencyCard } from '@/components/agency/HomeAgencyCard';
import PropertyCard, { PropertyCardSkeleton } from '@/components/property/card';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { useUserLocation } from '@/context/LocationContext';
import { fetchAgencies, type Agency } from '@/lib/agencies';
import { fetchCatalogProperties } from '@/lib/catalog';
import { PROPERTY_CATEGORIES } from '@/lib/categories';
import {
  MARKETPLACE_CITIES,
  propertyMatchesCity,
} from '@/lib/cities';
import { getErrorMessage } from '@/lib/feedback';
import { passesAvailableOnlyFilter, type Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HOME_CATEGORIES: Array<{
  key: 'all' | (typeof PROPERTY_CATEGORIES)[number]['key'];
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'all', label: 'Tous' },
  ...PROPERTY_CATEGORIES.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
  })),
];

export default function HomeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { label, loading, denied, refresh } = useUserLocation();
  const [properties, setProperties] = useState<Property[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [props, orgs] = await Promise.all([
        fetchCatalogProperties({ limit: 50 }),
        fetchAgencies(),
      ]);
      setProperties(props);
      setAgencies(orgs);
    } catch (err) {
      setCatalogError(
        getErrorMessage(err, 'Impossible de charger les biens'),
      );
    } finally {
      setCatalogLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCatalog();
    }, [loadCatalog]),
  );

  const cityStats = useMemo(() => {
    return MARKETPLACE_CITIES.map((city) => {
      const availableCount = properties.filter(
        (p) =>
          passesAvailableOnlyFilter(p) &&
          propertyMatchesCity(p.location, city.name),
      ).length;
      return { ...city, availableCount };
    });
  }, [properties]);

  const handleLocationPress = (): void => {
    if (denied) {
      showFeedback({
        type: 'warning',
        title: 'Localisation',
        message:
          'Autorisez l’accès à la position dans les réglages pour afficher les biens près de chez vous.',
        buttons: [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Réessayer',
            onPress: () => {
              void refresh();
            },
          },
        ],
      });
      return;
    }
    void refresh();
  };

  const handleCategoryPress = (
    key: (typeof HOME_CATEGORIES)[number]['key'],
  ): void => {
    if (key === 'all') return;
    router.push(`/category/${key}`);
  };

  const openCityMap = (cityName: string): void => {
    router.push({
      pathname: '/(tabs)/discover',
      params: { city: cityName },
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable
            style={styles.locationBlock}
            onPress={handleLocationPress}
            accessibilityRole="button"
            accessibilityLabel="Actualiser la position"
          >
            <Text style={styles.locationLabel}>Votre position</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.primary} />
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.locationLoader}
                />
              ) : (
                <Text style={styles.locationValue} numberOfLines={1}>
                  {label}
                </Text>
              )}
              <Ionicons name="chevron-down" size={18} color={colors.ink} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.ink}
            />
            <View style={styles.notificationBadge} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PropertyCard
            horizontalSpacing={true}
            property={item}
            onPress={() => router.push(`/property/${item.id}`)}
          />
        )}
        style={styles.list}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom,
          },
          properties.length === 0 && styles.contentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadCatalog(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          catalogLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((key) => (
                <PropertyCardSkeleton key={key} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCatalog}>
              <Text style={styles.emptyCatalogTitle}>
                {catalogError ? 'Chargement impossible' : 'Aucun bien'}
              </Text>
              <Text style={styles.emptyCatalogSubtitle}>
                {catalogError ??
                  'Les annonces apparaîtront ici dès qu’elles seront publiées.'}
              </Text>
              {catalogError ? (
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => void loadCatalog()}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryBtnText}>Réessayer</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchField}
                onPress={() => router.push('/search')}
                accessibilityRole="search"
                accessibilityLabel="Rechercher un bien"
              >
                <Ionicons name="search-outline" size={24} color={colors.muted} />
                <Text style={styles.searchPlaceholder}>Rechercher…</Text>
              </Pressable>

              <Pressable
                style={styles.filterButton}
                onPress={() => router.push('/filters')}
                accessibilityRole="button"
                accessibilityLabel="Filtres"
              >
                <Ionicons
                  name="options-outline"
                  size={24}
                  color={colors.ink}
                  style={styles.filterButtonIcon}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScroll}
              contentContainerStyle={styles.categories}
            >
              {HOME_CATEGORIES.map((item) => {
                const active = item.key === 'all';
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => handleCategoryPress(item.key)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    {item.icon ? (
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={active ? colors.onPrimary : colors.ink}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListFooterComponent={
          catalogLoading ? null : (
            <View style={styles.footerBlock}>
              <View style={styles.footerSection}>
                <Text style={styles.sectionLabel}>Agences</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.agenciesRow}
                >
                  {agencies.map((agency) => (
                    <HomeAgencyCard key={agency.id} agency={agency} />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.footerSection}>
                <Text style={styles.sectionLabel}>Villes</Text>
                <View style={styles.citiesColumn}>
                  {cityStats.map((city) => (
                    <Pressable
                      key={city.id}
                      style={({ pressed }) => [
                        styles.cityCard,
                        pressed && styles.cityCardPressed,
                      ]}
                      onPress={() => openCityMap(city.name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Carte ${city.name}`}
                    >
                      <View style={styles.cityIcon}>
                        <Ionicons
                          name="map-outline"
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.cityBody}>
                        <Text style={styles.cityName}>{city.name}</Text>
                        <Text style={styles.cityCount}>
                          {city.availableCount} bien
                          {city.availableCount > 1 ? 's' : ''} disponible
                          {city.availableCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.muted}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stickyHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.navy,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 2,
  },
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 0,
  },
  headerBlock: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  footerBlock: {
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  footerSection: {
    gap: 10,
  },
  separator: {
    height: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  locationBlock: {
    flex: 1,
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  locationLoader: {
    marginHorizontal: 4,
  },
  notificationButton: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.search,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    width: 10,
    height: 10,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    position: 'absolute',
    top: 12,
    right: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchField: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.search,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: colors.muted,
  },
  filterButton: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.search,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonIcon: {
    transform: [{ rotate: '90deg' }],
  },
  categoriesScroll: {
    flexGrow: 0,
  },
  categories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  sectionHint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
    marginTop: -4,
  },
  agenciesRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingRight: spacing.sm,
    paddingBottom: 4,
  },
  citiesColumn: {
    gap: 10,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cityCardPressed: {
    opacity: 0.94,
  },
  cityIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  cityCount: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: 20,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  emptyCatalog: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  skeletonList: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyCatalogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  emptyCatalogSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
