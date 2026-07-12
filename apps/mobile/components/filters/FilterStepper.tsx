import { colors, radii } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (value: number | null) => void;
};

export function FilterStepper({
  label,
  icon,
  value,
  min = 0,
  max = 6,
  onChange,
}: Props): React.JSX.Element {
  const display = value == null ? 0 : value;
  const atMin = display <= min;
  const atMax = display >= max;

  const decrement = (): void => {
    if (display <= min) return;
    const next = display - 1;
    onChange(next <= 0 ? null : next);
  };

  const increment = (): void => {
    if (display >= max) return;
    onChange(display + 1);
  };

  return (
    <View style={styles.row}>
      <View style={styles.labelWrap}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.muted} />
        ) : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.controls}>
        <Pressable
          style={[styles.btn, atMin && styles.btnDisabled]}
          onPress={decrement}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Ionicons
            name="remove"
            size={18}
            color={atMin ? colors.muted : colors.onPrimary}
          />
        </Pressable>
        <Text style={styles.value}>{value == null ? 'Tous' : String(value)}</Text>
        <Pressable
          style={[styles.btn, styles.btnPlus, atMax && styles.btnDisabled]}
          onPress={increment}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityLabel={`Augmenter ${label}`}
        >
          <Ionicons
            name="add"
            size={18}
            color={atMax ? colors.muted : colors.onPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPlus: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  value: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
});
