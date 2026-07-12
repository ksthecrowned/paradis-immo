import { colors, radii, spacing } from '@/constants/theme';
import {
  isInRange,
  monthGrid,
  monthTitleFr,
  shiftMonth,
  toDayKey,
  WEEKDAYS_FR,
} from '@/lib/calendar';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  /** Controlled visible month (YYYY-MM-DD of any day in month). */
  initialMonth?: string;
  mode?: 'single' | 'range';
  selected?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onSelectDate: (iso: string) => void;
  /** If set, only these dates are selectable (and get a marker). */
  enabledDates?: ReadonlySet<string>;
  minDate?: string;
  maxDate?: string;
};

export function MonthCalendar({
  initialMonth,
  mode = 'single',
  selected,
  rangeStart,
  rangeEnd,
  onSelectDate,
  enabledDates,
  minDate,
  maxDate,
}: Props): React.JSX.Element {
  const [monthKey, setMonthKey] = useState(
    () => initialMonth ?? selected ?? rangeStart ?? toDayKey(new Date()),
  );

  const cells = useMemo(() => monthGrid(monthKey), [monthKey]);

  const isDisabled = (day: string): boolean => {
    if (minDate && day < minDate) return true;
    if (maxDate && day > maxDate) return true;
    if (enabledDates && !enabledDates.has(day)) return true;
    return false;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          style={styles.navBtn}
          onPress={() => setMonthKey((m) => shiftMonth(m, -1))}
          accessibilityRole="button"
          accessibilityLabel="Mois précédent"
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitleFr(monthKey)}</Text>
        <Pressable
          style={styles.navBtn}
          onPress={() => setMonthKey((m) => shiftMonth(m, 1))}
          accessibilityRole="button"
          accessibilityLabel="Mois suivant"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS_FR.map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (!day) {
            return <View key={`e-${index}`} style={styles.cell} />;
          }

          const disabled = isDisabled(day);
          const isStart = mode === 'range' && day === rangeStart;
          const isEnd = mode === 'range' && day === rangeEnd;
          const inRange =
            mode === 'range' && isInRange(day, rangeStart, rangeEnd);
          const isSelected =
            mode === 'single'
              ? day === selected
              : isStart || isEnd;
          const marked = enabledDates?.has(day) ?? false;

          return (
            <Pressable
              key={day}
              style={[
                styles.cell,
                inRange && styles.cellInRange,
                isStart && rangeEnd && styles.cellRangeStart,
                isEnd && rangeStart && styles.cellRangeEnd,
              ]}
              disabled={disabled}
              onPress={() => onSelectDate(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={day}
            >
              <View
                style={[
                  styles.dayInner,
                  isSelected && styles.dayInnerSelected,
                  disabled && styles.dayInnerDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                    disabled && styles.dayTextDisabled,
                    inRange && !isSelected && styles.dayTextInRange,
                  ]}
                >
                  {Number(day.slice(8))}
                </Text>
                {marked && !isSelected ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const CELL_PCT = '14.2857%';

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    width: CELL_PCT,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_PCT,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellInRange: {
    backgroundColor: colors.primaryMuted,
  },
  cellRangeStart: {
    borderTopLeftRadius: radii.full,
    borderBottomLeftRadius: radii.full,
  },
  cellRangeEnd: {
    borderTopRightRadius: radii.full,
    borderBottomRightRadius: radii.full,
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInnerSelected: {
    backgroundColor: colors.primary,
  },
  dayInnerDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  dayTextSelected: {
    color: colors.surface,
  },
  dayTextDisabled: {
    color: colors.muted,
  },
  dayTextInRange: {
    color: colors.primary,
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
