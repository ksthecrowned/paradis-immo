import { colors, radii, spacing } from '@/constants/theme';
import {
  isGrayscaleCard,
  listingStatusLabel,
} from '@/lib/listing-status';
import { propertyStatusLabel, type Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type OverlayProps = {
  property: Property;
  compact: boolean;
};

function Overlay({ property, compact }: OverlayProps): React.JSX.Element {
  const grayscale = isGrayscaleCard(property);
  const label =
    listingStatusLabel(property) ?? propertyStatusLabel(property);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        grayscale && { backgroundColor: '#6B7280' },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          compact && styles.badgeTextCompact,
          grayscale && { color: '#FEFEFE' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

type FeaturedProps = {
  property: Property;
};

function FeaturedRibbon({ property }: FeaturedProps): React.JSX.Element | null {
  if (!property.isFeatured) return null;
  const grayscale = isGrayscaleCard(property);

  return (
    <View style={styles.featuredWrap}>
      <View
        style={[
          styles.featuredBadge,
          grayscale && { backgroundColor: '#6B7280' },
        ]}
      >
        <Ionicons
          name="sparkles-outline"
          size={14}
          color={grayscale ? '#FEFEFE' : colors.surface}
        />
        <Text
          style={[
            styles.featuredText,
            grayscale && { color: '#FEFEFE' },
          ]}
        >
          Coup de cœur
        </Text>
      </View>
      <View
        style={[
          styles.featuredTriangle,
          grayscale && { borderTopColor: '#4B5563' },
        ]}
      />
    </View>
  );
}

export const PropertyCardBadges = {
  Overlay,
  FeaturedRibbon,
};

const styles = StyleSheet.create({
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
  featuredWrap: {
    position: 'absolute',
    top: 200,
    left: -10,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderBottomLeftRadius: 0,
    backgroundColor: colors.primary,
  },
  featuredText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  featuredTriangle: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: '#4338CA',
    borderLeftColor: 'transparent',
  },
});
