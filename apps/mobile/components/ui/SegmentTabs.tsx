import { colors, radii } from '@/constants/theme';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export type SegmentTab = {
  key: string;
  label: string;
};

export function SegmentTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: SegmentTab[];
  value: string;
  onChange: (key: string) => void;
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  textActive: {
    color: colors.surface,
  },
});
