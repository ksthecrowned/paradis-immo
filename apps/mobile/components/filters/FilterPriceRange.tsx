import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  minBound: number;
  maxBound: number;
  step: number;
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
};

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ');
}

function parseAmount(raw: string): number | null {
  const digits = digitsOnly(raw);
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

type RowProps = {
  label: string;
  value: number;
  atMin: boolean;
  atMax: boolean;
  accessibilityLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onCommit: (next: number) => void;
};

function PriceStepperRow({
  label,
  value,
  atMin,
  atMax,
  accessibilityLabel,
  onDecrement,
  onIncrement,
  onCommit,
}: RowProps): React.JSX.Element {
  const [draft, setDraft] = useState(() => formatAmount(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatAmount(value));
  }, [value, focused]);

  const commitDraft = (): void => {
    const parsed = parseAmount(draft);
    if (parsed == null) {
      setDraft(formatAmount(value));
      return;
    }
    onCommit(parsed);
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          style={[styles.btn, atMin && styles.btnDisabled]}
          onPress={onDecrement}
          disabled={atMin}
          accessibilityRole="button"
          accessibilityLabel={`Diminuer ${label}`}
        >
          <Ionicons
            name="remove"
            size={18}
            color={atMin ? colors.muted : colors.ink}
          />
        </Pressable>
        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={(text) => setDraft(digitsOnly(text))}
            onFocus={() => {
              setFocused(true);
              setDraft(String(value));
            }}
            onBlur={() => {
              setFocused(false);
              commitDraft();
            }}
            onSubmitEditing={commitDraft}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel={accessibilityLabel}
          />
          <Text style={styles.currency}>FCFA</Text>
        </View>
        <Pressable
          style={[styles.btn, styles.btnPlus, atMax && styles.btnDisabled]}
          onPress={onIncrement}
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

export function FilterPriceRange({
  minBound,
  maxBound,
  step,
  minValue,
  maxValue,
  onChange,
}: Props): React.JSX.Element {
  const minCeiling = Math.max(minBound, maxValue);
  const maxFloor = Math.min(maxBound, minValue);

  const commitMin = (raw: number): void => {
    const next = Math.min(minCeiling, Math.max(minBound, Math.round(raw)));
    onChange(next, Math.max(maxValue, next));
  };

  const commitMax = (raw: number): void => {
    const next = Math.max(maxFloor, Math.min(maxBound, Math.round(raw)));
    onChange(Math.min(minValue, next), next);
  };

  return (
    <View style={styles.wrap}>
      <PriceStepperRow
        label="Minimum"
        value={minValue}
        atMin={minValue <= minBound}
        atMax={minValue >= minCeiling}
        accessibilityLabel="Prix minimum"
        onDecrement={() =>
          onChange(Math.max(minBound, minValue - step), maxValue)
        }
        onIncrement={() => {
          const next = Math.min(minCeiling, minValue + step);
          onChange(next, Math.max(maxValue, next));
        }}
        onCommit={commitMin}
      />
      <PriceStepperRow
        label="Maximum"
        value={maxValue}
        atMin={maxValue <= maxFloor}
        atMax={maxValue >= maxBound}
        accessibilityLabel="Prix maximum"
        onDecrement={() => {
          const next = Math.max(maxFloor, maxValue - step);
          onChange(Math.min(minValue, next), next);
        }}
        onIncrement={() =>
          onChange(minValue, Math.min(maxBound, maxValue + step))
        }
        onCommit={commitMax}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
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
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    flexShrink: 0,
    width: 72,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
    maxWidth: 160,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  currency: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
});
