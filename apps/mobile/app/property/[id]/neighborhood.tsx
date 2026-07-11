import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import { getPropertyById } from '@/lib/mock-properties';
import {
  formatDistance,
  formatWalkTime,
  getNeighborhoodPlaces,
  NEIGHBORHOOD_KIND_META,
  type NeighborhoodPlace,
} from '@/lib/neighborhood';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NeighborhoodScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const property = useMemo(() => getPropertyById(String(id ?? '')), [id]);
  const places = useMemo(
    () => (property ? getNeighborhoodPlaces(property) : []),
    [property],
  );

  const selected = places.find((place) => place.id === selectedId) ?? null;

  const focusPlace = (place: NeighborhoodPlace): void => {
    setSelectedId(place.id);
    const region: Region = {
      latitude: place.lat,
      longitude: place.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    mapRef.current?.animateToRegion(region, 350);
  };

  const focusProperty = (): void => {
    if (!property) return;
    setSelectedId(null);
    mapRef.current?.animateToRegion(
      {
        latitude: property.lat,
        longitude: property.lng,
        latitudeDelta: 0.018,
        longitudeDelta: 0.018,
      },
      350,
    );
  };

  if (!property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Bien introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: property.lat,
            longitude: property.lng,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          }}
          userInterfaceStyle={APP_MAP_USER_INTERFACE_STYLE}
        >
          <Marker
            coordinate={{ latitude: property.lat, longitude: property.lng }}
            title={property.title}
            pinColor={colors.primary}
            onPress={focusProperty}
          />
          {places.map((place) => (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              description={`${formatDistance(place.distanceMeters)} · ${formatWalkTime(place.walkMinutes)}`}
              pinColor={selectedId === place.id ? colors.primary : '#6C727F'}
              onPress={() => focusPlace(place)}
            />
          ))}
        </MapView>

        <View
          style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
          pointerEvents="box-none"
        >
          <CircleIconButton
            onPress={() => router.back()}
            accessibilityLabel="Retour"
          >
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </CircleIconButton>
          <View style={styles.titlePill}>
            <Ionicons name="map-outline" size={16} color={colors.primary} />
            <Text style={styles.titlePillText}>Voisinage</Text>
          </View>
          <CircleIconButton
            onPress={focusProperty}
            accessibilityLabel="Recentrer sur le bien"
          >
            <Ionicons name="locate-outline" size={22} color={colors.ink} />
          </CircleIconButton>
        </View>
      </View>

      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {property.title}
        </Text>
        <Text style={styles.sheetSubtitle}>
          {selected
            ? `${selected.name} · ${formatDistance(selected.distanceMeters)}`
            : `${places.length} lieux à proximité`}
        </Text>

        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.placeRow}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          renderItem={({ item }) => {
            const meta = NEIGHBORHOOD_KIND_META[item.kind];
            const active = selectedId === item.id;
            return (
              <Pressable
                style={[styles.placeCard, active && styles.placeCardActive]}
                onPress={() => focusPlace(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    styles.placeIcon,
                    active && styles.placeIconActive,
                  ]}
                >
                  <Ionicons
                    name={meta.icon}
                    size={16}
                    color={active ? colors.surface : colors.primary}
                  />
                </View>
                <Text
                  style={[styles.placeName, active && styles.placeNameActive]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[styles.placeMeta, active && styles.placeMetaActive]}
                >
                  {formatDistance(item.distanceMeters)} · {item.walkMinutes} min
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  mapWrap: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titlePill: {
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
  titlePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.md,
    gap: 6,
  },
  sheetTitle: {
    paddingHorizontal: spacing.md,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  sheetSubtitle: {
    paddingHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  placeRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  placeCard: {
    width: 168,
    gap: 6,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  placeIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeIconActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  placeName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  placeNameActive: {
    color: colors.surface,
  },
  placeMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  placeMetaActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  missing: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  missingBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
