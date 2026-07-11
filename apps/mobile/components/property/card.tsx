import { colors, radii, spacing } from '@/constants/theme';
import { isFavorite, toggleFavorite as persistToggleFavorite } from '@/lib/favorites';
import {
  propertyPriceLabel,
  propertyStatusLabel,
  type Property,
} from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

export interface PropertyCardProps {
  property: Property;
  /** `compact` = image + content side by side (map sheet). */
  variant?: 'default' | 'compact';
  /** Controlled initial heart state (e.g. favorites list). */
  initialFavorited?: boolean;
  onPress?: () => void;
  onContact?: () => void;
  onFavoriteChange?: (favorited: boolean) => void;
}

/** Whole-card desaturation — CSS on web, muted palette + washed image on native. */
function unavailableCardStyle(): ViewStyle | undefined {
  if (Platform.OS === 'web') {
    return { filter: 'grayscale(1)' } as ViewStyle;
  }
  return undefined;
}

export default function PropertyCard({
  property,
  variant = 'default',
  initialFavorited,
  onPress,
  onFavoriteChange,
}: PropertyCardProps): React.JSX.Element {
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const compact = variant === 'compact';
  const unavailable = property.availability === 'UNAVAILABLE';

  useEffect(() => {
    if (initialFavorited != null) {
      setFavorited(initialFavorited);
      return;
    }
    let cancelled = false;
    void isFavorite(property.id).then((value) => {
      if (!cancelled) setFavorited(value);
    });
    return () => {
      cancelled = true;
    };
  }, [property.id, initialFavorited]);

  const statusLabel = propertyStatusLabel(property);
  const priceLabel = propertyPriceLabel(property);

  const amenities: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }> = [];

  if (property.floor) {
    amenities.push({ icon: 'business-outline', label: property.floor });
  }
  if (property.surface) {
    amenities.push({ icon: 'resize-outline', label: property.surface });
  }
  if (property.bedrooms != null) {
    amenities.push({
      icon: 'bed-outline',
      label: `${property.bedrooms} ch.`,
    });
  }

  const toggleFavorite = (): void => {
    const next = !favorited;
    setFavorited(next);
    onFavoriteChange?.(next);
    void persistToggleFavorite(property.id).catch(() => {
      setFavorited(!next);
      onFavoriteChange?.(!next);
    });
  };

  const imageSource = property.coverImage
    ? { uri: property.coverImage }
    : require('@/assets/images/house2.jpg');

  const mutedIcon = unavailable ? '#9CA3AF' : colors.muted;
  const inkColor = unavailable ? '#6B7280' : colors.ink;
  const priceColor = unavailable ? '#6B7280' : colors.primary;

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          compact && styles.cardCompact,
          unavailable && styles.cardUnavailable,
          unavailable && unavailableCardStyle(),
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
        accessibilityState={{ disabled: unavailable }}
      >
        <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
          <Image
            source={imageSource}
            style={[
              compact ? styles.imageCompact : styles.image,
              unavailable && styles.imageUnavailable,
            ]}
            contentFit="cover"
          />
          {unavailable ? (
            <View style={styles.grayscaleWash} pointerEvents="none" />
          ) : null}

          <View
            style={[
              styles.badge,
              compact && styles.badgeCompact,
              unavailable && styles.badgeUnavailable,
            ]}
          >
            <Text
              style={[styles.badgeText, compact && styles.badgeTextCompact]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          </View>

          {!compact ? (
            <Pressable
              style={styles.favoriteBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                toggleFavorite();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'
              }
            >
              <Ionicons
                name={favorited ? 'heart' : 'heart-outline'}
                size={20}
                color={favorited ? colors.danger : colors.ink}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <View style={[styles.topRow, compact && styles.topRowCompact]}>
            <View style={styles.locationRow}>
              <Ionicons
                name="location"
                size={compact ? 12 : 14}
                color={mutedIcon}
              />
              <Text
                style={[
                  styles.location,
                  compact && styles.locationCompact,
                  unavailable && styles.textUnavailable,
                ]}
                numberOfLines={1}
              >
                {property.location ?? 'Congo'}
              </Text>
            </View>
            {!compact ? (
              <Text style={[styles.price, { color: priceColor }]}>
                {priceLabel}
              </Text>
            ) : null}
          </View>

          <Text
            style={[
              styles.title,
              compact && styles.titleCompact,
              { color: inkColor },
            ]}
            numberOfLines={compact ? 2 : 1}
          >
            {property.title}
          </Text>

          {compact ? (
            <Text style={[styles.priceCompact, { color: priceColor }]}>
              {priceLabel}
            </Text>
          ) : null}

          <View style={[styles.footer, compact && styles.footerCompact]}>
            <View style={styles.amenities}>
              {amenities.slice(0, compact ? 2 : amenities.length).map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.chip,
                    compact && styles.chipCompact,
                    unavailable && styles.chipUnavailable,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={compact ? 11 : 12}
                    color={mutedIcon}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      compact && styles.chipTextCompact,
                      unavailable && styles.textUnavailable,
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {compact ? (
              <Pressable
                style={styles.favoriteBtnCompact}
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggleFavorite();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'
                }
              >
                <Ionicons
                  name={favorited ? 'heart' : 'heart-outline'}
                  size={18}
                  color={favorited ? colors.danger : colors.ink}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.popularBadgeWrap}>
        <View style={styles.popularBadge}>
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={colors.surface}
          />
          <Text style={styles.popularBadgeText}>Popular</Text>
        </View>
        <View style={styles.popularBadgeTriangle} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnavailable: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 6,
  },
  cardPressed: {
    opacity: 0.98,
    transform: [{ scale: 0.995 }],
  },
  imageWrap: {
    position: 'relative',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrapCompact: {
    width: 96,
    height: 96,
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: 210,
  },
  imageCompact: {
    width: 96,
    height: 96,
  },
  imageUnavailable: {
    opacity: 0.55,
  },
  grayscaleWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120, 120, 120, 0.45)',
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  badgeUnavailable: {
    backgroundColor: '#6B7280',
  },
  badgeCompact: {
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  popularBadgeWrap: {
    position: 'absolute',
    top: 200,
    left: -10,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderBottomLeftRadius: 0,
    backgroundColor: colors.primary,
  },
  popularBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  popularBadgeTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: '#4338CA',
    borderLeftColor: 'transparent',
  },
  favoriteBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  favoriteBtnCompact: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  bodyCompact: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 4,
    justifyContent: 'center',
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topRowCompact: {
    justifyContent: 'flex-start',
  },
  locationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  location: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  locationCompact: {
    fontSize: 11,
  },
  textUnavailable: {
    color: '#9CA3AF',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  priceCompact: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  titleCompact: {
    fontSize: 14,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 4,
  },
  footerCompact: {
    marginTop: 2,
  },
  amenities: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipUnavailable: {
    borderColor: '#E5E7EB',
    backgroundColor: '#E5E7EB',
  },
  chipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    gap: 3,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  chipTextCompact: {
    fontSize: 10,
  },
});
