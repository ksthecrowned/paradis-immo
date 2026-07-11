import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { getPropertyGallery } from '@/lib/mock-properties';
import { useCatalogProperty } from '@/hooks/use-catalog-property';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ROOM_LABELS = [
  'Salon',
  'Cuisine',
  'Chambre 1',
  'Extérieur',
  'Salle de bain',
];

export default function Tour360Screen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<ImageSourcePropType>>(null);

  const { property, loading } = useCatalogProperty(String(id ?? ''));
  const gallery = useMemo(
    () => (property ? getPropertyGallery(property) : []),
    [property],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) setIndex(first.index);
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

  const roomLabel = ROOM_LABELS[index % ROOM_LABELS.length] ?? 'Pièce';

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={gallery}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
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
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image
              source={item}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                'rgba(16,10,85,0.5)',
                'transparent',
                'rgba(16,10,85,0.7)',
              ]}
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
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
          accessibilityLabel="Retour"
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.titlePill}>
          <Ionicons name="globe-outline" size={16} color={colors.surface} />
          <Text style={styles.titlePillText}>Visite 360°</Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1}/{Math.max(gallery.length, 1)}
          </Text>
        </View>
      </View>

      <View style={styles.hotspot} pointerEvents="none">
        <View style={styles.hotspotRing}>
          <Ionicons name="expand-outline" size={18} color={colors.surface} />
        </View>
      </View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <View style={styles.roomChip}>
          <Ionicons name="home-outline" size={14} color={colors.surface} />
          <Text style={styles.roomChipText}>{roomLabel}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle} numberOfLines={1}>
            {property.title}
          </Text>
          <Text style={styles.infoNote}>
            Visite virtuelle — glissez horizontalement pour changer de pièce.
            L’expérience 360° complète arrive bientôt.
          </Text>
          <View style={styles.dots}>
            {gallery.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: '100%',
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
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  titlePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  counter: {
    minWidth: 54,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  hotspot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotspotRing: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(112,101,240,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  roomChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  roomChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  infoCard: {
    gap: 6,
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  infoNote: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
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
