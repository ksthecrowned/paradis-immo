import { FilterPriceRange } from '@/components/filters/FilterPriceRange';
import { FilterSection } from '@/components/filters/FilterSection';
import { FilterStepper } from '@/components/filters/FilterStepper';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { priceBoundsForMode } from '@/lib/filter-price-bounds';
import {
  listArrondissements,
  listCities,
  listQuartiers,
  type PublicCity,
  type PublicQuartier,
} from '@/lib/locations';
import { PROPERTY_FEATURE_CATALOG } from '@/lib/property-features';
import { PROPERTY_CATEGORIES } from '@/lib/categories';
import {
  DEFAULT_SEARCH_FILTERS,
  filtersToParams,
  paramsToFilters,
  type SearchFilters,
} from '@/lib/search-filters';
import type { PropertyCategory, PropertyFeatureId } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MODES: Array<{ key: SearchFilters['mode']; label: string }> = [
  { key: 'RENT_LONG', label: 'Location' },
  { key: 'SALE', label: 'Vente' },
  { key: 'RENT_SHORT', label: 'Location journalière' },
];

const AGE_OPTIONS: Array<{
  key: string;
  label: string;
  maxAgeYears: number | null;
  minAgeYears: number | null;
}> = [
  { key: 'lt2', label: 'Moins de 2 ans', maxAgeYears: 2, minAgeYears: null },
  { key: 'lt5', label: 'Moins de 5 ans', maxAgeYears: 5, minAgeYears: null },
  { key: 'lt7', label: 'Moins de 7 ans', maxAgeYears: 7, minAgeYears: null },
  { key: 'gt7', label: 'Plus de 7 ans', maxAgeYears: null, minAgeYears: 7 },
];

const FEATURE_OPTIONS = (
  Object.keys(PROPERTY_FEATURE_CATALOG) as PropertyFeatureId[]
).map((id) => PROPERTY_FEATURE_CATALOG[id]);

const QUARTIER_PREVIEW_COUNT = 6;

function clampPrice(
  mode: SearchFilters['mode'],
  minPrice: number | null,
  maxPrice: number | null,
): { min: number; max: number } {
  const bounds = priceBoundsForMode(mode);
  const min = minPrice ?? bounds.min;
  const max = maxPrice ?? bounds.max;
  return {
    min: Math.max(bounds.min, Math.min(min, bounds.max - bounds.step)),
    max: Math.min(bounds.max, Math.max(max, bounds.min + bounds.step)),
  };
}

export default function FiltersScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const initial = useMemo(() => paramsToFilters(params), [params]);

  const [mode, setMode] = useState<SearchFilters['mode']>(initial.mode);
  const [cityId, setCityId] = useState<string | null>(initial.cityId);
  const [cityName, setCityName] = useState<string | null>(initial.cityName);
  const [quartierId, setQuartierId] = useState<string | null>(
    initial.quartierId,
  );
  const [quartierName, setQuartierName] = useState<string | null>(
    initial.quartierName,
  );
  const initialPrice = clampPrice(initial.mode, initial.minPrice, initial.maxPrice);
  const [minPrice, setMinPrice] = useState(initialPrice.min);
  const [maxPrice, setMaxPrice] = useState(initialPrice.max);
  const [priceTouched, setPriceTouched] = useState(
    initial.minPrice != null || initial.maxPrice != null,
  );
  const [minBedrooms, setMinBedrooms] = useState<number | null>(
    initial.minBedrooms,
  );
  const [minBathrooms, setMinBathrooms] = useState<number | null>(
    initial.minBathrooms,
  );
  const [categories, setCategories] = useState<PropertyCategory[]>(
    initial.categories,
  );
  const [features, setFeatures] = useState<PropertyFeatureId[]>(
    initial.features,
  );
  const [availableOnly, setAvailableOnly] = useState(initial.availableOnly);
  const [maxAgeYears, setMaxAgeYears] = useState<number | null>(
    initial.maxAgeYears,
  );
  const [minAgeYears, setMinAgeYears] = useState<number | null>(
    initial.minAgeYears,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [cities, setCities] = useState<PublicCity[]>([]);
  const [quartiers, setQuartiers] = useState<PublicQuartier[]>([]);
  const [quartiersExpanded, setQuartiersExpanded] = useState(false);
  const prevModeRef = useRef(mode);

  const bounds = priceBoundsForMode(mode);

  const visibleQuartiers = useMemo(() => {
    if (quartiersExpanded || quartiers.length <= QUARTIER_PREVIEW_COUNT) {
      return quartiers;
    }
    return quartiers.slice(0, QUARTIER_PREVIEW_COUNT);
  }, [quartiers, quartiersExpanded]);

  const canToggleQuartiers = quartiers.length > QUARTIER_PREVIEW_COUNT;

  useEffect(() => {
    let cancelled = false;
    void listCities('CG')
      .then((rows) => {
        if (!cancelled) setCities(rows);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cityId) {
      setQuartiers([]);
      setQuartiersExpanded(false);
      return;
    }
    let cancelled = false;
    setQuartiersExpanded(false);
    void (async () => {
      try {
        const arrs = await listArrondissements(cityId);
        const nested = await Promise.all(
          arrs.map((arr) => listQuartiers(arr.id)),
        );
        if (!cancelled) {
          setQuartiers(nested.flat().sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch {
        if (!cancelled) setQuartiers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    const b = priceBoundsForMode(mode);
    setMinPrice(b.min);
    setMaxPrice(b.max);
    setPriceTouched(false);
  }, [mode]);

  const selectCity = (city: PublicCity): void => {
    if (cityId === city.id) {
      setCityId(null);
      setCityName(null);
      setQuartierId(null);
      setQuartierName(null);
      return;
    }
    setCityId(city.id);
    setCityName(city.name);
    setQuartierId(null);
    setQuartierName(null);
  };

  const selectQuartier = (q: PublicQuartier): void => {
    if (quartierId === q.id) {
      setQuartierId(null);
      setQuartierName(null);
      return;
    }
    setQuartierId(q.id);
    setQuartierName(q.name);
  };

  const toggleCategory = (key: PropertyCategory): void => {
    setCategories((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const toggleFeature = (id: PropertyFeatureId): void => {
    setFeatures((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectAge = (option: (typeof AGE_OPTIONS)[number]): void => {
    const active =
      maxAgeYears === option.maxAgeYears &&
      minAgeYears === option.minAgeYears;
    if (active) {
      setMaxAgeYears(null);
      setMinAgeYears(null);
      return;
    }
    setMaxAgeYears(option.maxAgeYears);
    setMinAgeYears(option.minAgeYears);
  };

  const advancedCount = useMemo(() => {
    let count = 0;
    count += features.length;
    if (availableOnly) count += 1;
    if (maxAgeYears != null || minAgeYears != null) count += 1;
    return count;
  }, [features.length, availableOnly, maxAgeYears, minAgeYears]);

  const handleReset = (): void => {
    setMode(DEFAULT_SEARCH_FILTERS.mode);
    setCityId(null);
    setCityName(null);
    setQuartierId(null);
    setQuartierName(null);
    const b = priceBoundsForMode(DEFAULT_SEARCH_FILTERS.mode);
    setMinPrice(b.min);
    setMaxPrice(b.max);
    setPriceTouched(false);
    setMinBedrooms(null);
    setMinBathrooms(null);
    setCategories([]);
    setFeatures([]);
    setAvailableOnly(false);
    setMaxAgeYears(null);
    setMinAgeYears(null);
    setAdvancedOpen(false);
    setQuartiersExpanded(false);
  };

  const handleApply = (): void => {
    const next: SearchFilters = {
      q: initial.q,
      mode,
      cityId,
      cityName,
      quartierId,
      quartierName,
      minPrice: priceTouched ? minPrice : null,
      maxPrice: priceTouched ? maxPrice : null,
      minBedrooms,
      minBathrooms,
      categories,
      features,
      availableOnly,
      maxAgeYears,
      minAgeYears,
    };
    router.replace({
      pathname: '/search',
      params: filtersToParams(next),
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Filtres</Text>
        <Pressable
          onPress={handleReset}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Réinitialiser"
        >
          <Text style={styles.reset}>Réinit.</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 85 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FilterSection title="Type d’annonce">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={[
              styles.chipScroll,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.full,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 5,
                paddingHorizontal: 8,
              }
            ]}
          >
            {MODES.map((item) => {
              const active = mode === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[
                    {
                      paddingHorizontal: 24,
                      paddingVertical: 16,
                      borderRadius: radii.full,
                    },
                    active && styles.chipActive,
                    {
                      borderColor: "transparent",
                    }
                  ]}
                  onPress={() => setMode(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </FilterSection>

        <FilterSection title="Type de bien">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.categoryScroll}
          >
            {PROPERTY_CATEGORIES.map((item) => {
              const active = categories.includes(item.key);
              return (
                <Pressable
                  key={item.key}
                  style={[styles.categoryChip, active && styles.chipActive]}
                  onPress={() => toggleCategory(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={item.label}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={active ? colors.onPrimary : colors.ink}
                  />
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
        </FilterSection>

        <FilterSection title="Ville">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.chipScroll}
          >
            {cities.map((city) => {
              const active = cityId === city.id;
              return (
                <Pressable
                  key={city.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => selectCity(city)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {city.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </FilterSection>

        {cityId && quartiers.length > 0 ? (
          <FilterSection title="Quartier">
            <View style={styles.quartierBlock}>
              <View style={styles.chipRow}>
                {visibleQuartiers.map((q) => {
                  const active = quartierId === q.id;
                  return (
                    <Pressable
                      key={q.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectQuartier(q)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active && styles.chipTextActive,
                        ]}
                      >
                        {q.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {canToggleQuartiers ? (
                <Pressable
                  style={styles.showMoreBtn}
                  onPress={() => setQuartiersExpanded((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: quartiersExpanded }}
                >
                  <Text style={styles.showMoreText}>
                    {quartiersExpanded
                      ? 'Afficher moins'
                      : `Afficher plus (${quartiers.length - QUARTIER_PREVIEW_COUNT})`}
                  </Text>
                  <Ionicons
                    name={quartiersExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                </Pressable>
              ) : null}
            </View>
          </FilterSection>
        ) : null}

        <FilterSection title="Budget">
          <FilterPriceRange
            minBound={bounds.min}
            maxBound={bounds.max}
            step={bounds.step}
            minValue={minPrice}
            maxValue={maxPrice}
            onChange={(min, max) => {
              setPriceTouched(true);
              setMinPrice(min);
              setMaxPrice(max);
            }}
          />
        </FilterSection>

        <FilterSection title="Plus de détails">
          <FilterStepper
            label="Nbre de chambres"
            icon="bed-outline"
            value={minBedrooms}
            min={0}
            max={10}
            onChange={setMinBedrooms}
          />
          <FilterStepper
            label="Nbre de salles de bain"
            icon="water-outline"
            value={minBathrooms}
            min={0}
            max={10}
            onChange={setMinBathrooms}
          />
        </FilterSection>

        <Pressable
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
        >
          <Text style={styles.advancedToggleText}>
            {advancedOpen ? 'Afficher moins' : 'Afficher plus'}
          </Text>
          {advancedCount > 0 && !advancedOpen ? (
            <View style={styles.advancedBadge}>
              <Text style={styles.advancedBadgeText}>{advancedCount}</Text>
            </View>
          ) : null}
          <Ionicons
            name={advancedOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary}
          />
        </Pressable>

        {advancedOpen ? (
          <>
            <FilterSection
              title="Équipements"
              subtitle="Sélectionnez un ou plusieurs critères"
            >
              <View style={styles.chipRow}>
                {FEATURE_OPTIONS.map((item) => {
                  const active = features.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleFeature(item.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={15}
                        color={active ? colors.onPrimary : colors.ink}
                      />
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
              </View>
            </FilterSection>

            <FilterSection title="Disponibilité">
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, availableOnly && styles.chipActive]}
                  onPress={() => setAvailableOnly((value) => !value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: availableOnly }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      availableOnly && styles.chipTextActive,
                    ]}
                  >
                    Disponibles seulement
                  </Text>
                </Pressable>
              </View>
            </FilterSection>

            <FilterSection title="Âge du bien">
              <View style={styles.chipRow}>
                {AGE_OPTIONS.map((item) => {
                  const active =
                    maxAgeYears === item.maxAgeYears &&
                    minAgeYears === item.minAgeYears;
                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => selectAge(item)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
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
              </View>
            </FilterSection>
          </>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.applyBtn,
            pressed && styles.applyBtnPressed,
          ]}
          onPress={handleApply}
          accessibilityRole="button"
          accessibilityLabel="Appliquer les filtres"
        >
          <Text style={styles.applyBtnText}>Appliquer</Text>
        </Pressable>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  reset: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 54,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  categoryScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  categoryChip: {
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
  quartierBlock: {
    gap: 10,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
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
  hint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  advancedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  advancedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  applyBtn: {
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  applyBtnPressed: {
    backgroundColor: colors.primaryHover,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
