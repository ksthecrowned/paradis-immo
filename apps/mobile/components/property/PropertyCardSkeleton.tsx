import { colors, radii, spacing } from '@/constants/theme';
import { StyleSheet, View } from 'react-native';

type Props = {
  variant?: 'default' | 'compact';
};

export default function PropertyCardSkeleton({
  variant = 'default',
}: Props): React.JSX.Element {
  const compact = variant === 'compact';

  if (compact) {
    return (
      <View style={[styles.card, styles.cardCompact]}>
        <View style={styles.imageCompact} />
        <View style={styles.bodyCompact}>
          <View style={[styles.line, { width: '60%' }]} />
          <View style={[styles.line, { width: '80%', height: 14 }]} />
          <View style={[styles.line, { width: '40%' }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.image} />
      <View style={styles.body}>
        <View style={[styles.line, { width: '45%' }]} />
        <View style={[styles.line, { width: '70%', height: 18 }]} />
        <View style={styles.chips}>
          <View style={styles.chip} />
          <View style={styles.chip} />
          <View style={styles.chip} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 6,
  },
  image: {
    width: '100%',
    height: 210,
    borderRadius: radii.lg,
    backgroundColor: colors.border,
  },
  imageCompact: {
    width: 120,
    height: 120,
    borderRadius: radii.lg,
    backgroundColor: colors.border,
    flexShrink: 0,
  },
  body: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  bodyCompact: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 4,
  },
  line: {
    height: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    width: 64,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
});
