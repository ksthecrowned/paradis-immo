import PropertyCard from '@/components/property/card';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import {
  getFallbackCoords,
  useUserLocation,
} from '@/context/LocationContext';
import { fetchCatalogProperties } from '@/lib/catalog';
import { getCityByName, propertyMatchesCity } from '@/lib/cities';
import { POINTE_NOIRE_REGION } from '@/lib/mock-properties';
import {
  passesAvailableOnlyFilter,
  type Property,
} from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiscoverScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { coords } = useUserLocation();
  const { city: cityParam } = useLocalSearchParams<{ city?: string | string[] }>();
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
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        try {
          const rows = await fetchCatalogProperties({ limit: 50 });
          if (active) setProperties(rows);
        } catch {
          if (active) setProperties([]);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const visibleProperties = useMemo(() => {
    const available = properties.filter(passesAvailableOnlyFilter);
    if (!cityFilter) return available;
    return available.filter((p) => propertyMatchesCity(p.location, cityFilter));
  }, [properties, cityFilter]);

  const selected = useMemo(
    () => visibleProperties.find((p) => p.id === selectedId) ?? null,
    [visibleProperties, selectedId],
  );

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

  useEffect(() => {
    if (loading) return;
    if (cityRegion) {
      mapRef.current?.animateToRegion(cityRegion, 400);
      return;
    }
    if (visibleProperties.length > 0) {
      const first = visibleProperties[0]!;
      mapRef.current?.animateToRegion(
        {
          latitude: first.lat,
          longitude: first.lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        350,
      );
    }
  }, [loading, cityRegion, cityFilter, visibleProperties]);

  useEffect(() => {
    setSelectedId(null);
  }, [cityFilter]);

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

  const chipLabel = loading
    ? 'Chargement…'
    : cityFilter
      ? `${visibleProperties.length} bien${visibleProperties.length > 1 ? 's' : ''} · ${cityFilter}`
      : `${visibleProperties.length} biens disponibles`;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={cityRegion ?? (coords ? userRegion : POINTE_NOIRE_REGION)}
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
        </View>
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

      {!loading && cityFilter && visibleProperties.length === 0 ? (
        <View
          style={[
            styles.emptyBanner,
            { bottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={styles.emptyTitle}>Aucun bien disponible</Text>
          <Text style={styles.emptySubtitle}>
            Pas d’annonce disponible pour {cityFilter} pour le moment.
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
