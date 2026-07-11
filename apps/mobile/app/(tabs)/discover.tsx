import PropertyCard from '@/components/property/card';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import {
  getFallbackCoords,
  useUserLocation,
} from '@/context/LocationContext';
import {
  MOCK_PROPERTIES,
  POINTE_NOIRE_REGION,
} from '@/lib/mock-properties';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = useState(180);

  const selected = useMemo(
    () => MOCK_PROPERTIES.find((p) => p.id === selectedId) ?? null,
    [selectedId],
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

  const focusProperty = useCallback(
    (property: Property) => {
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
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  const recenter = useCallback(() => {
    mapRef.current?.animateToRegion(userRegion, 350);
  }, [userRegion]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={coords ? userRegion : POINTE_NOIRE_REGION}
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
        {MOCK_PROPERTIES.map((property) => {
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
                  color={active ? colors.surface : colors.primary}
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
        <View style={styles.topChip}>
          <Ionicons name="map" size={16} color={colors.primary} />
          <Text style={styles.topChipText}>
            {MOCK_PROPERTIES.length} biens à Pointe-Noire
          </Text>
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
  topChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  topChipText: {
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
    shadowOpacity: 0.2,
    shadowRadius: 3,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
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
  selectedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  emptySheet: {
    paddingVertical: spacing.md,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
