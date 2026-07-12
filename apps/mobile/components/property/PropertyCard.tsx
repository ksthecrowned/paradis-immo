import { colors, radii, spacing } from '@/constants/theme';
import {
  isFavorite,
  toggleFavorite as persistToggleFavorite,
} from '@/lib/favorites';
import { propertyPriceLabel, type Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PropertyCardBadges } from './PropertyCardBadges';
import { PropertyCardBody } from './PropertyCardBody';
import { PropertyCardImage } from './PropertyCardImage';

export interface PropertyCardProps {
  /** Whether to add horizontal padding to the card. */
  horizontalSpacing?: boolean;
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
  horizontalSpacing = false,
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
    <View style={[styles.wrap, { paddingHorizontal: horizontalSpacing ? spacing.md : 0 }]}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          compact && styles.cardCompact,
          pressed && styles.cardPressed,
        ]}
        onPress={onPress}
      >
        <PropertyCardImage
          property={property}
          compact={compact}
          favorited={favorited}
          onToggleFavorite={toggleFavorite}
          imageSource={imageSource}
        />
        <PropertyCardBody
          property={property}
          compact={compact}
          priceLabel={priceLabel}
          amenities={amenities}
          favorited={favorited}
          onToggleFavorite={toggleFavorite}
        />
      </Pressable>
      {!compact ? (
        <PropertyCardBadges.FeaturedRibbon property={property} horizontalSpacing={horizontalSpacing} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
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
});
