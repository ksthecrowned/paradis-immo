import { colors, radii, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

const GALLERY_GAP = 8;
const GALLERY_CELL = 130;
const GALLERY_HEIGHT = GALLERY_CELL * 2 + GALLERY_GAP;

function GalleryImage({
  source,
  square = false,
}: {
  source: ImageSourcePropType;
  square?: boolean;
}): React.JSX.Element {
  return (
    <View style={square ? styles.gallerySquareCell : styles.galleryLandscapeCell}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  );
}

type Props = {
  propertyId: string;
  gallery: ImageSourcePropType[];
  previewPhotos: ImageSourcePropType[];
};

export function PropertyDetailGalleryPreview({
  propertyId,
  gallery,
  previewPhotos,
}: Props): React.JSX.Element {
  const openGallery = (startIndex = 0): void => {
    router.push({
      pathname: '/property/[id]/gallery',
      params: { id: propertyId, index: String(startIndex) },
    });
  };

  return (
    <>
      <Text style={styles.sectionTitle}>Photos</Text>
      <View style={styles.gallery}>
        <View style={styles.galleryLandscapeCol}>
          {previewPhotos[0] ? (
            <Pressable
              style={styles.galleryLandscapeCell}
              onPress={() => openGallery(0)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Voir la photo 1"
            >
              <GalleryImage source={previewPhotos[0]} />
            </Pressable>
          ) : null}
          {previewPhotos[1] ? (
            <Pressable
              style={styles.galleryLandscapeCell}
              onPress={() => openGallery(1)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Voir la photo 2"
            >
              <GalleryImage source={previewPhotos[1]} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.gallerySquareCol}>
          {previewPhotos[2] ? (
            <Pressable
              style={styles.gallerySquareCell}
              onPress={() => openGallery(2)}
              accessibilityRole="imagebutton"
              accessibilityLabel="Voir la photo 3"
            >
              <GalleryImage source={previewPhotos[2]} square />
            </Pressable>
          ) : null}
          {previewPhotos[3] ? (
            <Pressable
              style={styles.gallerySquareCell}
              onPress={() => openGallery(3)}
              accessibilityRole="button"
              accessibilityLabel={`Tout afficher (${gallery.length})`}
            >
              {previewPhotos[3] ? (
                <Image
                  source={previewPhotos[3]}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[StyleSheet.absoluteFill, styles.galleryPlaceholder]}
                />
              )}
              {previewPhotos.length > 4 ? (
                <View style={styles.galleryMoreOverlay}>
                  <Text style={styles.galleryMoreText}>
                    Tout afficher ({gallery.length})
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  gallery: {
    height: GALLERY_HEIGHT,
    flexDirection: 'row',
    gap: GALLERY_GAP,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  galleryLandscapeCol: {
    flex: 1,
    gap: GALLERY_GAP,
  },
  gallerySquareCol: {
    width: GALLERY_CELL,
    gap: GALLERY_GAP,
  },
  galleryLandscapeCell: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  gallerySquareCell: {
    width: GALLERY_CELL,
    height: 121,
    overflow: 'hidden',
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  galleryPlaceholder: {
    backgroundColor: colors.primaryMuted,
  },
  galleryMoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 10, 85, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  galleryMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
});
