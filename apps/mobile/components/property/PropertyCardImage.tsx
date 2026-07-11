import { colors, radii, spacing } from '@/constants/theme';
import { isGrayscaleCard } from '@/lib/listing-status';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { PropertyCardBadges } from './PropertyCardBadges';

type Props = {
  property: Property;
  compact: boolean;
  favorited: boolean;
  onToggleFavorite: () => void;
  imageSource: ImageSourcePropType;
};

export function PropertyCardImage({
  property,
  compact,
  favorited,
  onToggleFavorite,
  imageSource,
}: Props): React.JSX.Element {
  const grayscale = isGrayscaleCard(property);

  return (
    <View style={[styles.imageWrap, compact && styles.imageWrapCompact]}>
      <Image
        source={imageSource}
        style={[
          compact ? styles.imageCompact : styles.image,
          grayscale ? ({ filter: 'grayscale(100%)' } as ImageStyle) : undefined,
        ]}
        resizeMode="cover"
      />

      <PropertyCardBadges.Overlay property={property} compact={compact} />

      {!compact ? (
        <Pressable
          style={styles.favoriteBtn}
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
            size={20}
            color={grayscale ? '#6B7280' : favorited ? colors.danger : colors.ink}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
