import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAP_HEIGHT = 300;

export default function PropertyDetailSkeleton(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.topActions}>
          <View style={styles.circlePlaceholder} />
          <View style={styles.circlePlaceholder} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View
          style={[styles.mapHero, { height: MAP_HEIGHT + insets.top }]}
        >
          <View style={styles.mapFill} />
          <View style={styles.mapChrome}>
            <View style={styles.pinPlaceholder} />
            <View style={styles.mapChips}>
              <View style={styles.mapChip} />
              <View style={styles.mapChip} />
              <View style={styles.mapChip} />
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <View style={[styles.line, styles.priceLine]} />
            <View style={[styles.line, styles.titleLine]} />
            <View style={[styles.line, styles.locationLine]} />
          </View>

          <View style={styles.amenityRow}>
            <View style={styles.amenityChip} />
            <View style={styles.amenityChip} />
            <View style={styles.amenityChip} />
          </View>

          <View style={styles.section}>
            <View style={[styles.line, styles.sectionTitle]} />
            <View style={[styles.line, { width: '100%' }]} />
            <View style={[styles.line, { width: '92%' }]} />
            <View style={[styles.line, { width: '78%' }]} />
          </View>

          <View style={styles.section}>
            <View style={[styles.line, styles.sectionTitle]} />
            <View style={styles.photoGrid}>
              <View style={styles.photoCell} />
              <View style={styles.photoCell} />
              <View style={styles.photoCell} />
              <View style={styles.photoCell} />
            </View>
          </View>

          <View style={styles.section}>
            <View style={[styles.line, styles.sectionTitle]} />
            <View style={styles.agentRow}>
              <View style={styles.agentAvatar} />
              <View style={styles.agentText}>
                <View style={[styles.line, { width: '55%' }]} />
                <View style={[styles.line, { width: '40%', height: 10 }]} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circlePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scroll: {
    flex: 1,
  },
  mapHero: {
    width: '100%',
    backgroundColor: colors.border,
    position: 'relative',
  },
  mapFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.border,
  },
  mapChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: MAP_HEIGHT / 3,
    alignItems: 'center',
    gap: spacing.md,
  },
  pinPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapChips: {
    flexDirection: 'row',
    gap: 8,
  },
  mapChip: {
    width: 88,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: {
    marginTop: -24,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  titleBlock: {
    gap: 10,
    backgroundColor: colors.bg,
    paddingTop: spacing.sm,
  },
  line: {
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  priceLine: {
    width: '42%',
    height: 22,
  },
  titleLine: {
    width: '78%',
    height: 18,
  },
  locationLine: {
    width: '55%',
    height: 12,
  },
  amenityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  amenityChip: {
    width: 72,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    width: '36%',
    height: 16,
    marginBottom: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCell: {
    width: '48%',
    flexGrow: 1,
    aspectRatio: 1.2,
    borderRadius: radii.lg,
    backgroundColor: colors.border,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  agentAvatar: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  agentText: {
    flex: 1,
    gap: 8,
  },
});
