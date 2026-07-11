import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import {
  getPropertyById,
  getPropertyGallery,
} from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StreetViewScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showMapHint, setShowMapHint] = useState(true);

  const property = useMemo(() => getPropertyById(String(id ?? '')), [id]);
  const gallery = useMemo(
    () => (property ? getPropertyGallery(property) : []),
    [property],
  );
  const cover = gallery[0];

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

  return (
    <View style={styles.screen}>
      {cover ? (
        <Image source={cover} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: property.lat,
            longitude: property.lng,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          }}
          userInterfaceStyle={APP_MAP_USER_INTERFACE_STYLE}
          pitchEnabled
          rotateEnabled
        />
      )}

      <LinearGradient
        colors={['rgba(16,10,85,0.55)', 'transparent', 'rgba(16,10,85,0.75)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          style={styles.darkBtn}
        >
          <Ionicons name="close" size={22} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.titlePill}>
          <Ionicons name="scan-outline" size={16} color={colors.surface} />
          <Text style={styles.titlePillText}>Street View</Text>
        </View>
        <View style={styles.spacer} />
      </View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        {showMapHint ? (
          <View style={styles.hint}>
            <Ionicons name="hand-left-outline" size={16} color={colors.surface} />
            <Text style={styles.hintText}>
              Glissez pour explorer la rue autour du bien
            </Text>
            <Pressable
              onPress={() => setShowMapHint(false)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Fermer l’indication"
            >
              <Ionicons name="close" size={16} color={colors.surface} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle} numberOfLines={1}>
            {property.title}
          </Text>
          <Text style={styles.infoLocation} numberOfLines={1}>
            {property.location ?? 'Pointe-Noire'}
          </Text>
          <Text style={styles.infoNote}>
            Aperçu Street View — la navigation immersive complète arrive bientôt.
          </Text>
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
  darkBtn: {
    backgroundColor: colors.surface,
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
  spacer: {
    width: 54,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  hintText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.surface,
  },
  infoCard: {
    gap: 4,
    padding: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  infoLocation: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  infoNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
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
