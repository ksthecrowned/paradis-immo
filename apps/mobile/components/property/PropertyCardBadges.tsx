import { colors, radii, spacing } from '@/constants/theme';
import {
  isGrayscaleCard,
  listingStatusCardLabel,
} from '@/lib/listing-status';
import { propertyStatusLabel, type Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type OverlayProps = {
  property: Property;
};

/** Status pill over the photo — default (tall) cards only. */
function Overlay({ property }: OverlayProps): React.JSX.Element {
  const grayscale = isGrayscaleCard(property);
  const label =
    listingStatusCardLabel(property) ?? propertyStatusLabel(property);

  return (
    <View
      style={[
        styles.badge,
        grayscale && { backgroundColor: '#6B7280', opacity: 0.75 },
      ]}
    >
      <Text
        style={[styles.badgeText, grayscale && { color: '#FEFEFE' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

type FeaturedProps = {
  property: Property;
  horizontalSpacing: boolean;
};

function FeaturedRibbon({
  property,
  horizontalSpacing,
}: FeaturedProps): React.JSX.Element | null {
  if (!property.isFeatured) return null;
  const grayscale = isGrayscaleCard(property);

  return (
    <View style={[styles.featuredWrap, { left: horizontalSpacing ? 7 : 0 }]}>
      <View
        style={[
          styles.featuredBadge,
          grayscale && { backgroundColor: '#6B7280' },
        ]}
      >
        <Ionicons
          name="sparkles-outline"
          size={14}
          color={grayscale ? '#FEFEFE' : colors.onPrimary}
        />
        <Text
          style={[styles.featuredText, grayscale && { color: '#FEFEFE' }]}
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

type CompactMetaProps = {
  property: Property;
};

/**
 * Compact cards: status + featured live in the text column so the
 * 96×96 thumb stays readable.
 */
function CompactMeta({
  property,
}: CompactMetaProps): React.JSX.Element | null {
  const grayscale = isGrayscaleCard(property);
  const status = listingStatusCardLabel(property);
  const featured = property.isFeatured;

  if (!status && !featured) return null;

  return (
    <View style={styles.compactMeta}>
      {featured ? (
        <View
          style={[
            styles.compactChip,
            styles.compactFeatured,
            grayscale && styles.compactChipMuted,
          ]}
          accessibilityLabel="Coup de cœur"
        >
          <Ionicons
            name="sparkles"
            size={10}
            color={grayscale ? '#FEFEFE' : colors.primary}
          />
          {/* Label only when there is room (no status competing). */}
          {!status ? (
            <Text
              style={[
                styles.compactChipText,
                styles.compactFeaturedText,
                grayscale && { color: '#FEFEFE' },
              ]}
              numberOfLines={1}
            >
              Coup de cœur
            </Text>
          ) : null}
        </View>
      ) : null}
      {status ? (
        <View
          style={[
            styles.compactChip,
            styles.compactStatus,
            grayscale && styles.compactChipMuted,
          ]}
        >
          <Text
            style={[
              styles.compactChipText,
              styles.compactStatusText,
              grayscale && { color: '#FEFEFE' },
            ]}
            numberOfLines={1}
          >
            {status}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const PropertyCardBadges = {
  Overlay,
  FeaturedRibbon,
  CompactMeta,
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
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  featuredWrap: {
    position: 'absolute',
    top: 185,
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
    color: colors.onPrimary,
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
  compactMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
    maxWidth: '100%',
  },
  compactFeatured: {
    backgroundColor: colors.primaryMuted,
  },
  compactStatus: {
    backgroundColor: colors.primary,
  },
  compactChipMuted: {
    backgroundColor: '#6B7280',
  },
  compactChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  compactFeaturedText: {
    color: colors.primary,
  },
  compactStatusText: {
    color: colors.onPrimary,
  },
});
