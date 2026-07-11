import { colors, radii, spacing } from '@/constants/theme';
import { isGrayscaleCard } from '@/lib/listing-status';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
        numberOfLines={compact ? 2 : 1}
      >
        {property.title}
      </Text>

      {compact ? <Text style={styles.priceCompact}>{priceLabel}</Text> : null}

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
        ) : null}
      </View>
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
});
