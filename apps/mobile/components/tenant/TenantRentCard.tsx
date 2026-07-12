import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { formatDueLabel } from '@/lib/format-date-fr';
import {
  rentScheduleStatusLabel,
  rentScheduleStatusTone,
  type RentLineView,
} from '@/lib/leases';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

type Props = {
  line: RentLineView;
  canPay: boolean;
  onPay: () => void;
};

export function TenantRentCard({
  line,
  canPay,
  onPay,
}: Props): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Prochain loyer</Text>
      <View style={styles.row}>
        <Text style={styles.label}>{line.label}</Text>
        <StatusBadge
          label={rentScheduleStatusLabel(line.status)}
          tone={rentScheduleStatusTone(line.status)}
        />
      </View>
      <Text style={styles.amount}>{formatFcfa(line.amount)}</Text>
      <Text style={styles.due}>Échéance · {formatDueLabel(line.dueDate)}</Text>
      {canPay ? (
        <Pressable
          style={({ pressed }) => [styles.payBtn, pressed && styles.payPressed]}
          onPress={onPay}
          accessibilityRole="button"
          accessibilityLabel="Payer le loyer"
        >
          <Text style={styles.payText}>Payer</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  amount: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: -0.4,
  },
  due: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  payBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payPressed: {
    opacity: 0.92,
  },
  payText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
});
