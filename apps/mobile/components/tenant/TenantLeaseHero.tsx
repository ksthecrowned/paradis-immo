import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import {
  leaseStatusLabel,
  leaseStatusTone,
} from '@/lib/leases';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  property: Property;
  leaseStatus: string;
  agencyName?: string;
};

export function TenantLeaseHero({
  property,
  leaseStatus,
  agencyName,
}: Props): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <StatusBadge
          label={leaseStatusLabel(leaseStatus)}
          tone={leaseStatusTone(leaseStatus)}
        />
        {agencyName ? (
          <Text style={styles.agency} numberOfLines={1}>
            {agencyName}
          </Text>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {property.title}
      </Text>
      <View style={styles.locationRow}>
        <Ionicons name="location" size={14} color={colors.muted} />
        <Text style={styles.location} numberOfLines={1}>
          {property.location ?? 'Congo'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  agency: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
});
