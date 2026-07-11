import { colors, radii } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: '#DCFCE7', fg: colors.success },
  warning: { bg: colors.warningSoft, fg: '#B45309' },
  danger: { bg: '#FEE2E2', fg: colors.danger },
  neutral: { bg: colors.primaryMuted, fg: colors.muted },
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}): React.JSX.Element {
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
