import { AgencyChip } from '@/components/agency/AgencyChip';
import { colors, radii, spacing } from '@/constants/theme';
import { isFavorite, toggleFavorite as persistToggleFavorite } from '@/lib/favorites';
import {
  propertyPriceLabel,
  propertyStatusLabel,
  type Property,
} from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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

export default function PropertyCard({
  property,
  variant = 'default',
  initialFavorited,
  onPress,
  onFavoriteChange,
}: PropertyCardProps): React.JSX.Element {
  const [favorited, setFavorited] = useState(initialFavorited ?? false);
  const compact = variant === 'compact';

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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
        <Image
          source={imageSource}
          style={compact ? styles.imageCompact : styles.image}
          resizeMode="cover"
        />

        <View style={[styles.badge, compact && styles.badgeCompact]}>
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
            <Ionicons name="location" size={compact ? 12 : 14} color={colors.muted} />
            <Text style={[styles.location, compact && styles.locationCompact]} numberOfLines={1}>
              {property.location ?? 'Congo'}
            </Text>
          </View>
          {!compact ? (
            <Text style={styles.price}>{priceLabel}</Text>
          ) : null}
        </View>

        <Text
          style={[styles.title, compact && styles.titleCompact]}
          numberOfLines={compact ? 2 : 1}
        >
          {property.title}
        </Text>

        {!compact ? (
          <View style={styles.agencyWrap}>
            <AgencyChip agencyId={property.agencyId} />
          </View>
        ) : null}

        {compact ? (
          <Text style={styles.priceCompact}>{priceLabel}</Text>
        ) : null}

        <View style={[styles.footer, compact && styles.footerCompact]}>
          <View style={styles.amenities}>
            {amenities.slice(0, compact ? 2 : amenities.length).map((item) => (
              <View
                key={item.label}
                style={[styles.chip, compact && styles.chipCompact]}
              >
                <Ionicons
                  name={item.icon}
                  size={compact ? 11 : 12}
                  color={colors.muted}
                />
                <Text
                  style={[styles.chipText, compact && styles.chipTextCompact]}
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
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.full,
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
  agencyWrap: {
    marginTop: 4,
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
