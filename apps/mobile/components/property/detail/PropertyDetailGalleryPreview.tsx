import { colors, radii, spacing } from '@/constants/theme';
import type { PropertyMediaItem } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function VideoPreviewTile({
  url,
  square = false,
  onPress,
}: {
  url: string;
  square?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={square ? styles.gallerySquareCell : styles.galleryLandscapeCell}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Lire la vidéo"
    >
      <View style={[StyleSheet.absoluteFill, styles.videoPlaceholder]} />
      <View style={styles.playBadge}>
        <Ionicons name="play" size={22} color={colors.surface} />
      </View>
      <Text style={styles.videoHint} numberOfLines={1}>
        Vidéo
      </Text>
    </Pressable>
  );
}

function VideoPlayerModal({
  url,
  visible,
  onClose,
}: {
  url: string;
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.videoModal, { paddingTop: insets.top }]}>
        <Pressable
          onPress={onClose}
          style={styles.videoClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={24} color={colors.surface} />
        </Pressable>
        <VideoView
          style={styles.videoPlayer}
          player={player}
          nativeControls
        />
      </View>
    </Modal>
  );
}

type Props = {
  propertyId: string;
  gallery: ImageSourcePropType[];
  previewPhotos: ImageSourcePropType[];
  mediaItems?: PropertyMediaItem[];
};

export function PropertyDetailGalleryPreview({
  propertyId,
  gallery,
  previewPhotos,
  mediaItems,
}: Props): React.JSX.Element {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const openGallery = (startIndex = 0): void => {
    router.push({
      pathname: '/property/[id]/gallery',
      params: { id: propertyId, index: String(startIndex) },
    });
  };

  const slots: Array<
    | { kind: 'photo'; source: ImageSourcePropType; index: number }
    | { kind: 'video'; url: string }
  > = [];

  if (mediaItems && mediaItems.length > 0) {
    for (const item of mediaItems.slice(0, 4)) {
      if (item.type === 'VIDEO') {
        slots.push({ kind: 'video', url: item.url });
      } else {
        slots.push({
          kind: 'photo',
          source: { uri: item.url },
          index: slots.length,
        });
      }
    }
  } else {
    previewPhotos.forEach((source, index) => {
      slots.push({ kind: 'photo', source, index });
    });
  }

  const left = slots.slice(0, 2);
  const right = slots.slice(2, 4);

  return (
    <>
      <Text style={styles.sectionTitle}>Photos</Text>
      <View style={styles.gallery}>
        <View style={styles.galleryLandscapeCol}>
          {left.map((slot, i) =>
            slot.kind === 'video' ? (
              <VideoPreviewTile
                key={`v-${i}`}
                url={slot.url}
                onPress={() => setVideoUrl(slot.url)}
              />
            ) : (
              <Pressable
                key={`p-${i}`}
                style={styles.galleryLandscapeCell}
                onPress={() => openGallery(slot.index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Voir la photo ${slot.index + 1}`}
              >
                <GalleryImage source={slot.source} />
              </Pressable>
            ),
          )}
        </View>
        <View style={styles.gallerySquareCol}>
          {right.map((slot, i) =>
            slot.kind === 'video' ? (
              <VideoPreviewTile
                key={`vr-${i}`}
                url={slot.url}
                square
                onPress={() => setVideoUrl(slot.url)}
              />
            ) : (
              <Pressable
                key={`pr-${i}`}
                style={styles.gallerySquareCell}
                onPress={() => openGallery(slot.index)}
                accessibilityRole="imagebutton"
                accessibilityLabel={
                  i === 1 && gallery.length > 4
                    ? `Tout afficher (${gallery.length})`
                    : `Voir la photo ${slot.index + 1}`
                }
              >
                <GalleryImage source={slot.source} square />
                {i === 1 && gallery.length > 4 ? (
                  <View style={styles.galleryMoreOverlay}>
                    <Text style={styles.galleryMoreText}>
                      Tout afficher ({gallery.length})
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ),
          )}
        </View>
      </View>
      {videoUrl ? (
        <VideoPlayerModal
          url={videoUrl}
          visible
          onClose={() => setVideoUrl(null)}
        />
      ) : null}
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
  videoPlaceholder: {
    backgroundColor: '#1C1C1E',
  },
  playBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoHint: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 11,
    fontWeight: '700',
    color: colors.surface,
  },
  videoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  videoClose: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
});
