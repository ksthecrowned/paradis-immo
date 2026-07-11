import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { getPropertyGallery } from '@/lib/mock-properties';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_SIZE = 64;

export default function PropertyGalleryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id, index: indexParam } = useLocalSearchParams<{
    id: string;
    index?: string;
  }>();
  const initialIndex = Math.max(0, Number.parseInt(String(indexParam ?? '0'), 10) || 0);

  const [index, setIndex] = useState(initialIndex);
  const pagerRef = useRef<FlatList<ImageSourcePropType>>(null);
  const thumbsRef = useRef<FlatList<ImageSourcePropType>>(null);

  const { property, loading } = useCatalogProperty(String(id ?? ''));
  const gallery = useMemo(
    () => (property ? getPropertyGallery(property) : []),
    [property],
  );

  useEffect(() => {
    if (gallery.length === 0) return;
    const safe = Math.min(initialIndex, gallery.length - 1);
    setIndex(safe);
    requestAnimationFrame(() => {
      pagerRef.current?.scrollToIndex({ index: safe, animated: false });
      thumbsRef.current?.scrollToIndex({
        index: safe,
        animated: false,
        viewPosition: 0.5,
      });
    });
  }, [gallery.length, initialIndex]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index == null) return;
      setIndex(first.index);
      thumbsRef.current?.scrollToIndex({
        index: first.index,
        animated: true,
        viewPosition: 0.5,
      });
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  if (!property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Bien introuvable</Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  if (gallery.length === 0) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Aucune photo</Text>
        <Pressable onPress={() => router.back()} style={styles.missingBtn}>
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const goTo = (next: number): void => {
    const safe = Math.max(0, Math.min(next, gallery.length - 1));
    setIndex(safe);
    pagerRef.current?.scrollToIndex({ index: safe, animated: true });
  };

  return (
    <View style={styles.screen}>
      <FlatList
        ref={pagerRef}
        data={gallery}
        keyExtractor={(_, i) => `photo-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(initialIndex, gallery.length - 1)}
        getItemLayout={(_, i) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * i,
          index: i,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={(
          event: NativeSyntheticEvent<NativeScrollEvent>,
        ) => {
          const next = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setIndex(next);
        }}
        onScrollToIndexFailed={({ index: failedIndex }) => {
          requestAnimationFrame(() => {
            pagerRef.current?.scrollToIndex({
              index: failedIndex,
              animated: false,
            });
          });
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image
              source={item}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}
      />

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.titlePill}>
          <Ionicons name="images-outline" size={16} color={colors.ink} />
          <Text style={styles.titlePillText}>
            {index + 1} / {gallery.length}
          </Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Text style={styles.caption} numberOfLines={1}>
          {property.title}
        </Text>
        <FlatList
          ref={thumbsRef}
          data={gallery}
          keyExtractor={(_, i) => `thumb-${i}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}
          getItemLayout={(_, i) => ({
            length: THUMB_SIZE + 8,
            offset: (THUMB_SIZE + 8) * i,
            index: i,
          })}
          onScrollToIndexFailed={({ index: failedIndex }) => {
            requestAnimationFrame(() => {
              thumbsRef.current?.scrollToIndex({
                index: failedIndex,
                animated: false,
                viewPosition: 0.5,
              });
            });
          }}
          renderItem={({ item, index: thumbIndex }) => {
            const active = thumbIndex === index;
            return (
              <Pressable
                onPress={() => goTo(thumbIndex)}
                style={[styles.thumbWrap, active && styles.thumbWrapActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Photo ${thumbIndex + 1}`}
              >
                <Image
                  source={item}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B12',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0B12',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  titlePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  spacer: {
    width: 54,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 12,
    backgroundColor: 'rgba(11, 11, 18, 0.72)',
  },
  caption: {
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
  thumbs: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.7,
  },
  thumbWrapActive: {
    borderColor: colors.primary,
    opacity: 1,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  missing: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  missingBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
