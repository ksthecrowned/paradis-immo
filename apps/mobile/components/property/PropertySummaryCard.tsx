import { colors, radii, spacing } from '@/constants/theme';
import { getPropertyGallery } from '@/lib/mock-properties';
import {
  propertyPriceLabel,
  type Property,
} from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

export function PropertySummaryCard({
  property,
}: {
  property: Property;
}): React.JSX.Element {
  const gallery = getPropertyGallery(property);
  const cover = gallery[0] ?? require('@/assets/images/house2.jpg');

  return (
    <View style={styles.card}>
      <Image source={cover} style={styles.image} resizeMode="cover" />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {property.title}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={colors.muted} />
          <Text style={styles.location} numberOfLines={1}>
            {property.location ?? 'Congo'}
          </Text>
        </View>
        <Text style={styles.price}>{propertyPriceLabel(property)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
