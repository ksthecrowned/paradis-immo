import { colors, radii, spacing } from '@/constants/theme';
import {
  isGrayscaleCard,
  listingStatusCardLabel,
} from '@/lib/listing-status';
import type { Property } from '@/types/property';
import { Ionicons, Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PropertyCardBadges } from './PropertyCardBadges';

type Amenity = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

type Props = {
  property: Property;
  compact: boolean;
  priceLabel: string;
  amenities: Amenity[];
  favorited: boolean;
  onToggleFavorite: () => void;
};

export function PropertyCardBody({
  property,
  compact,
  priceLabel,
  amenities,
  favorited,
  onToggleFavorite,
}: Props): React.JSX.Element {
  const grayscale = isGrayscaleCard(property);
  const muted = grayscale ? '#6B7280' : undefined;
  const hasCompactMeta =
    compact &&
    (property.isFeatured || listingStatusCardLabel(property) != null);

  return (
    <View style={[styles.body, compact && styles.bodyCompact]}>
      <View style={[styles.topRow, compact && styles.topRowCompact]}>
        <View style={styles.locationRow}>
          <Ionicons
            name="location"
            size={compact ? 12 : 14}
            color={colors.muted}
          />
          <Text
            style={[styles.location, compact && styles.locationCompact]}
            numberOfLines={1}
          >
            {property.location ?? 'Congo'}
          </Text>
        </View>
        {!compact ? (
          <Text style={[styles.price, muted ? { color: muted } : null]}>
            {priceLabel}
          </Text>
        ) : null}
      </View>

      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          muted ? { color: muted } : null,
        ]}
        numberOfLines={1}
      >
        {property.title}
      </Text>

      {compact ? <PropertyCardBadges.CompactMeta property={property} /> : null}

      {compact ? (
        <View style={styles.priceRowCompact}>
          <Text
            style={[styles.priceCompact, muted ? { color: muted } : null]}
            numberOfLines={1}
          >
            {priceLabel}
          </Text>
          <Pressable
            style={styles.favoriteBtnCompact}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite();
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
              color={
                grayscale ? '#6B7280' : favorited ? colors.danger : colors.ink
              }
            />
          </Pressable>
        </View>
      ) : null}

      {!compact || !hasCompactMeta ? (
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
          {!compact ? (
            <Pressable
              onPress={() => router.push(`/property/${property.id}`)}
              style={[
                styles.ctaBtn,
                grayscale && { backgroundColor: '#6B7280', opacity: 0.5 },
              ]}
            >
              <Octicons
                name="arrow-up-right"
                size={24}
                color={colors.onPrimary}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  priceRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 4,
  },
  footerCompact: {
    marginTop: 0,
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
  ctaBtn: {
    marginTop: -20,
    height: 50,
    width: 50,
    padding: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTextCompact: {
    fontSize: 10,
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
    flexShrink: 0,
  },
});
