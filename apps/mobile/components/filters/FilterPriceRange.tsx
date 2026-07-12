import { colors, radii, spacing } from '@/constants/theme';
import { formatFilterPrice } from '@/lib/filter-price-bounds';
import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  minBound: number;
  maxBound: number;
  step: number;
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
};

export function FilterPriceRange({
  minBound,
  maxBound,
  step,
  minValue,
  maxValue,
  onChange,
}: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={styles.label}>Minimum</Text>
        <Slider
          style={styles.slider}
          minimumValue={minBound}
          maximumValue={maxBound}
          step={step}
          value={minValue}
          onValueChange={(value) => {
            const next = Math.min(value, maxValue - step);
            onChange(Math.max(minBound, next), maxValue);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel="Prix minimum"
        />
        <Text style={styles.amount}>{formatFilterPrice(minValue)}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>Maximum</Text>
        <Slider
          style={styles.slider}
          minimumValue={minBound}
          maximumValue={maxBound}
          step={step}
          value={maxValue}
          onValueChange={(value) => {
            const next = Math.max(value, minValue + step);
            onChange(minValue, Math.min(maxBound, next));
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel="Prix maximum"
        />
        <Text style={styles.amount}>{formatFilterPrice(maxValue)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  block: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
});
