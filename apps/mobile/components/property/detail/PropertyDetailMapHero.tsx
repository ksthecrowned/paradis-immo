import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import type { Property, PropertyMapView } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAP_HEIGHT,
  MAP_VIEW_META,
  type PropertyAmenity,
} from './constants';

type Props = {
  property: Property;
  priceLabel: string;
  statusLabel: string;
  statusBadge: string | null;
  amenities: PropertyAmenity[];
  mapViews: PropertyMapView[];
  activeMapView: PropertyMapView;
  onMapViewPress: (view: PropertyMapView) => void;
};

export function PropertyDetailMapHero({
  property,
  priceLabel,
  statusLabel,
  statusBadge,
  amenities,
  mapViews,
  activeMapView,
  onMapViewPress,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const activeMapMeta = MAP_VIEW_META[activeMapView];

  return (
    <View style={styles.mapHero}>
      <View style={[styles.mapFrame, { height: MAP_HEIGHT + insets.top }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: property.lat,
            longitude: property.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          }}
          userInterfaceStyle={APP_MAP_USER_INTERFACE_STYLE}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          pointerEvents="none"
        />

        <LinearGradient
          colors={[
            'rgba(247, 247, 253, 0.25)',
            'rgba(247, 247, 253, 0.55)',
            colors.bg,
          ]}
          locations={[0, 0.45, 1]}
          style={styles.mapGradient}
          pointerEvents="none"
        />

        <View style={styles.mapCenterChrome} pointerEvents="box-none">
          <View style={styles.mapPinOuter}>
            <View style={styles.mapPinInner}>
              <Ionicons
                name={activeMapMeta.pinIcon}
                size={20}
                color={colors.ink}
              />
            </View>
          </View>
          {mapViews.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mapViewScroll}
              contentContainerStyle={styles.mapViewRow}
            >
              {mapViews.map((view) => {
                const meta = MAP_VIEW_META[view];
                const active = activeMapView === view;
                return (
                  <Pressable
                    key={view}
                    onPress={() => onMapViewPress(view)}
                    style={[
                      styles.mapViewChip,
                      active && styles.mapViewChipActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={meta.label}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={15}
                      color={active ? colors.ink : colors.surface}
                    />
                    <Text
                      style={[
                        styles.mapViewChipText,
                        active && styles.mapViewChipTextActive,
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </View>

      <View style={styles.overlayContent}>
        <View style={styles.heroHeader}>
          <Text style={styles.price}>{priceLabel}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {property.title}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={15} color={colors.primary} />
            <Text style={styles.location} numberOfLines={1}>
              {property.location ?? 'Congo'}
            </Text>
          </View>
        </View>

        <View style={styles.trustRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
          {statusBadge ? (
            <View style={styles.indispoBadge}>
              <Text style={styles.indispoBadgeText}>{statusBadge}</Text>
            </View>
          ) : null}
        </View>

        {amenities.length > 0 ? (
          <View style={styles.featureRow}>
            {amenities.map((item) => (
              <View key={item.label} style={styles.featureCard}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
                <Text style={styles.featureLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapHero: {
    backgroundColor: colors.bg,
  },
  mapFrame: {
    position: 'relative',
    backgroundColor: colors.primarySoft,
  },
  mapGradient: {
    ...StyleSheet.absoluteFill,
  },
  mapCenterChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '26%',
    zIndex: 10,
    alignItems: 'center',
    gap: 14,
  },
  mapPinOuter: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: 'rgba(108, 114, 127, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinInner: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapViewScroll: {
    flexGrow: 0,
    maxWidth: '100%',
  },
  mapViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  mapViewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  mapViewChipActive: {
    backgroundColor: colors.surface,
  },
  mapViewChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.surface,
  },
  mapViewChipTextActive: {
    color: colors.ink,
  },
  overlayContent: {
    marginTop: -132,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    zIndex: 5,
  },
  heroHeader: {
    gap: 8,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    marginTop: 2,
  },
  location: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  indispoBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  indispoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
  },
  featureCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
});
