import PropertyCard from '@/components/property/card';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import { getFallbackCoords, useUserLocation } from '@/context/LocationContext';
import { fetchCatalogPropertiesPage } from '@/lib/catalog';
import { getCityByName } from '@/lib/cities';
import { getErrorMessage } from '@/lib/feedback';
import { viewportToPropertyFilters } from '@/lib/map-viewport';
import { POINTE_NOIRE_REGION } from '@/lib/map-regions';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PAGE_SIZE = 20;

export default function DiscoverScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { city: cityParam } = useLocalSearchParams<{
    city?: string | string[];
  }>();
  const cityFilter =
    typeof cityParam === 'string'
      ? cityParam
      : Array.isArray(cityParam)
        ? cityParam[0]
        : undefined;
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = useState(180);
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [unmapped, setUnmapped] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const userRegion = useMemo((): Region => {
    const point = coords ?? getFallbackCoords();
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [coords]);

  const cityRegion = useMemo((): Region | null => {
    if (!cityFilter) return null;
    return getCityByName(cityFilter)?.region ?? null;
  }, [cityFilter]);

  const initialRegion =
    cityRegion ?? (coords ? userRegion : POINTE_NOIRE_REGION);
  const currentRegionRef = useRef<Region>(initialRegion);
  const requestIdRef = useRef(0);
  const regionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedRequestRef = useRef<{
    region: Region;
    offset: number;
    append: boolean;
  } | null>(null);

  const loadProperties = useCallback(
    async (
      region: Region,
      offset = 0,
      append = false,
      isActive: () => boolean = () => true,
    ): Promise<void> => {
      const requestId = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setLoadError(null);
      failedRequestRef.current = null;
      try {
        const page = await fetchCatalogPropertiesPage({
          ...viewportToPropertyFilters(region, cityFilter),
          availableOnly: true,
          limit: PAGE_SIZE,
          offset,
        });
        if (!isActive() || requestId !== requestIdRef.current) return;
        setProperties((current) => {
          if (!append) return page.data;
          const existing = new Set(current.map((property) => property.id));
          return [
            ...current,
            ...page.data.filter((property) => !existing.has(property.id)),
          ];
        });
        setTotal(page.total);
        setUnmapped(page.unmapped ?? 0);
      } catch (err) {
        if (isActive() && requestId === requestIdRef.current) {
          failedRequestRef.current = { region, offset, append };
          setLoadError(getErrorMessage(err, 'Impossible de charger la carte'));
        }
      } finally {
        if (isActive() && requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [cityFilter],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadProperties(currentRegionRef.current, 0, false, () => active);
      return () => {
        active = false;
        requestIdRef.current += 1;
        if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
      };
    }, [loadProperties]),
  );

  useEffect(() => {
    setSelectedId(null);
  }, [cityFilter]);

  useEffect(() => {
    if (cityRegion) mapRef.current?.animateToRegion(cityRegion, 400);
  }, [cityRegion]);

  const visibleProperties = properties;
  const selected = useMemo(
    () => visibleProperties.find((p) => p.id === selectedId) ?? null,
    [visibleProperties, selectedId],
  );

  const onRegionChangeComplete = useCallback(
    (region: Region): void => {
      currentRegionRef.current = region;
      if (regionTimerRef.current) clearTimeout(regionTimerRef.current);
      requestIdRef.current += 1;
      setProperties([]);
      setTotal(0);
      setUnmapped(0);
      setSelectedId(null);
      setLoading(true);
      setLoadingMore(false);
      setLoadError(null);
      regionTimerRef.current = setTimeout(() => {
        void loadProperties(region);
      }, 350);
    },
    [loadProperties],
  );

  const loadMore = useCallback((): void => {
    if (loading || loadingMore || properties.length >= total) return;
    void loadProperties(currentRegionRef.current, properties.length, true);
  }, [loadProperties, loading, loadingMore, properties.length, total]);

  const retry = useCallback((): void => {
    const failed = failedRequestRef.current;
    void loadProperties(
      failed?.region ?? currentRegionRef.current,
      failed?.offset ?? 0,
      failed?.append ?? false,
    );
  }, [loadProperties]);

  const focusProperty = useCallback((property: Property) => {
    setSelectedId(property.id);
    mapRef.current?.animateToRegion(
      {
        latitude: property.lat,
        longitude: property.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      350,
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  const clearCityFilter = useCallback(() => {
    router.replace('/(tabs)/discover');
  }, []);

  const recenter = useCallback(() => {
    if (cityRegion) {
      mapRef.current?.animateToRegion(cityRegion, 350);
      return;
    }
    mapRef.current?.animateToRegion(userRegion, 350);
  }, [cityRegion, userRegion]);

  const chipLabel =
    loading && properties.length === 0
      ? 'Recherche dans la zone…'
      : `${visibleProperties.length} affiché${visibleProperties.length === 1 ? '' : 's'} / ${total} · ${cityFilter ?? 'cette zone'}`;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        userInterfaceStyle={APP_MAP_USER_INTERFACE_STYLE}
        showsUserLocation
        showsMyLocationButton={false}
        mapPadding={{
          top: insets.top + 56,
          right: 0,
          bottom: sheetHeight + 24,
          left: 0,
        }}
      >
        {visibleProperties.map((property) => {
          const active = property.id === selectedId;
          return (
            <Marker
              key={property.id}
              coordinate={{
                latitude: property.lat,
                longitude: property.lng,
              }}
              onPress={() => focusProperty(property)}
              tracksViewChanges={false}
            >
              <View style={[styles.pin, active && styles.pinActive]}>
                <Ionicons
                  name="home"
                  size={16}
                  color={active ? colors.onPrimary : colors.primary}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={styles.topChipRow}>
          <View style={styles.topChip}>
            <Ionicons name="map" size={16} color={colors.primary} />
            <Text style={styles.topChipText}>{chipLabel}</Text>
          </View>
          {cityFilter ? (
            <Pressable
              style={styles.clearChip}
              onPress={clearCityFilter}
              accessibilityRole="button"
              accessibilityLabel="Retirer le filtre ville"
            >
              <Ionicons name="close" size={16} color={colors.ink} />
              <Text style={styles.clearChipText}>Tout</Text>
            </Pressable>
          ) : null}
          {total > properties.length || loadingMore ? (
            <Pressable
              style={styles.clearChip}
              onPress={loadMore}
              disabled={loadingMore || loading}
              accessibilityRole="button"
              accessibilityLabel="Charger plus de biens sur la carte"
            >
              <Text style={styles.clearChipText}>
                {loadingMore
                  ? 'Chargement…'
                  : `Afficher plus (${total - properties.length})`}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {loadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable
              onPress={retry}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Réessayer de charger la carte"
            >
              <Text style={styles.retryText}>
                {loading ? 'Chargement…' : 'Réessayer'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {unmapped > 0 ? (
          <View style={styles.unmappedBanner}>
            <Text style={styles.unmappedText}>
              {unmapped} annonce{unmapped === 1 ? '' : 's'} sans coordonnées
              n’apparaît{unmapped === 1 ? '' : 'ssent'} pas sur la carte.
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[styles.mapOverlay, { bottom: sheetHeight + 24 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={recenter}
          style={styles.recenterBtn}
          accessibilityRole="button"
          accessibilityLabel="Recentrer la carte"
        >
          <Ionicons name="locate" size={20} color={colors.ink} />
        </Pressable>
      </View>

      {selected && (
        <BottomSheet onLayoutHeight={setSheetHeight}>
          <View style={styles.selectedBlock}>
            <View style={styles.selectedHeader}>
              <View />
              <Pressable
                onPress={clearSelection}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <PropertyCard
              variant="compact"
              property={selected}
              onPress={() => router.push(`/property/${selected.id}`)}
            />
          </View>
        </BottomSheet>
      )}

      {!loading && !loadError && visibleProperties.length === 0 ? (
        <View
          style={[styles.emptyBanner, { bottom: insets.bottom + spacing.lg }]}
        >
          <Text style={styles.emptyTitle}>Aucun bien géolocalisé</Text>
          <Text style={styles.emptySubtitle}>
            {unmapped > 0
              ? `${unmapped} annonce${unmapped === 1 ? '' : 's'} ne possède${unmapped === 1 ? '' : 'nt'} pas de coordonnées. Déplacez ou élargissez la carte pour chercher ailleurs.`
              : `Aucune annonce disponible dans ${cityFilter ?? 'cette zone'} pour le moment. Déplacez ou élargissez la carte.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
  },
  topChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  errorBanner: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  unmappedBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  unmappedText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  topChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  topChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  pinActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryHover,
    transform: [{ scale: 1.08 }],
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    top: undefined,
    paddingHorizontal: 14,
    zIndex: 15,
  },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedBlock: {
    gap: spacing.sm,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emptyBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    zIndex: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
});
