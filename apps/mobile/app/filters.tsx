import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { listAgencies } from '@/lib/mock-agencies';
import { PROPERTY_FEATURE_CATALOG } from '@/lib/property-features';
import {
  DEFAULT_SEARCH_FILTERS,
  filtersToParams,
  paramsToFilters,
  type SearchFilters,
} from '@/lib/search-filters';
import type { PropertyFeatureId } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MODES: Array<{ key: SearchFilters['mode']; label: string }> = [
  { key: 'ALL', label: 'Tous' },
  { key: 'SALE', label: 'À vendre' },
  { key: 'RENT_LONG', label: 'À louer' },
  { key: 'RENT_SHORT', label: 'À la journée' },
];

const BEDROOM_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'Tous' },
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 3, label: '3+' },
  { value: 4, label: '4+' },
];

const FEATURE_OPTIONS = (
  Object.keys(PROPERTY_FEATURE_CATALOG) as PropertyFeatureId[]
).map((id) => PROPERTY_FEATURE_CATALOG[id]);

export default function FiltersScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const initial = useMemo(() => paramsToFilters(params), [params]);

  const [mode, setMode] = useState<SearchFilters['mode']>(initial.mode);
  const [minBedrooms, setMinBedrooms] = useState<number | null>(
    initial.minBedrooms,
  );
  const [features, setFeatures] = useState<PropertyFeatureId[]>(
    initial.features,
  );
  const [agencyIds, setAgencyIds] = useState<string[]>(initial.agencyIds);
  const [availableOnly, setAvailableOnly] = useState(initial.availableOnly);

  const toggleFeature = (id: PropertyFeatureId): void => {
    setFeatures((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const toggleAgency = (id: string): void => {
    setAgencyIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handleReset = (): void => {
    setMode(DEFAULT_SEARCH_FILTERS.mode);
    setMinBedrooms(DEFAULT_SEARCH_FILTERS.minBedrooms);
    setFeatures([]);
    setAgencyIds([]);
    setAvailableOnly(false);
  };

  const handleApply = (): void => {
    const next: SearchFilters = {
      q: initial.q,
      mode,
      minBedrooms,
      features,
      agencyIds,
      availableOnly,
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
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FilterSection title="Disponibilité">
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.chip, availableOnly && styles.chipActive]}
              onPress={() => setAvailableOnly((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ selected: availableOnly }}
              accessibilityLabel="Disponibles seulement"
            >
              <Text
                style={[styles.chipText, availableOnly && styles.chipTextActive]}
              >
                Disponibles seulement
              </Text>
            </Pressable>
          </View>
        </FilterSection>

        <FilterSection title="Type d’annonce">
          <View style={styles.chipRow}>
            {MODES.map((item) => {
              const active = mode === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setMode(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        <FilterSection title="Chambres">
          <View style={styles.chipRow}>
            {BEDROOM_OPTIONS.map((item) => {
              const active = minBedrooms === item.value;
              return (
                <Pressable
                  key={item.label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setMinBedrooms(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        <FilterSection title="Agence" subtitle="Une ou plusieurs agences">
          <View style={styles.chipRow}>
            {listAgencies().map((agency) => {
              const active = agencyIds.includes(agency.id);
              return (
                <Pressable
                  key={agency.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleAgency(agency.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={agency.name}
                >
                  <View
                    style={[
                      styles.agencyDot,
                      { backgroundColor: agency.logoColor },
                    ]}
                  />
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {agency.shortName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

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
                    color={active ? colors.surface : colors.ink}
                  />
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>
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

function FilterSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  sectionSubtitle: {
    marginTop: -6,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 14,
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
  agencyDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.surface,
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
    color: colors.surface,
  },
});
