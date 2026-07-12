import { colors, radii, spacing } from '@/constants/theme';
import type { MockLease } from '@/lib/mock-leases';
import { getPropertyById } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Props = {
  leases: MockLease[];
  selectedId: string;
  onSelect: (leaseId: string) => void;
};

export function TenantLeaseSwitcher({
  leases,
  selectedId,
  onSelect,
}: Props): React.JSX.Element | null {
  if (leases.length < 2) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Vos biens</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {leases.map((lease) => {
          const selected = lease.id === selectedId;
          const property = getPropertyById(lease.propertyId);
          return (
            <Pressable
              key={lease.id}
              style={[styles.card, selected && styles.cardActive]}
              onPress={() => onSelect(lease.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={property?.title ?? 'Bien'}
            >
              <View
                style={[styles.iconWrap, selected && styles.iconWrapActive]}
              >
                <Ionicons
                  name="home"
                  size={16}
                  color={selected ? colors.surface : colors.primary}
                />
              </View>
              <View style={styles.body}>
                <Text
                  style={[styles.title, selected && styles.titleActive]}
                  numberOfLines={1}
                >
                  {property?.title ?? 'Bien'}
                </Text>
                <Text
                  style={[styles.meta, selected && styles.metaActive]}
                  numberOfLines={1}
                >
                  {property?.location ?? 'Congo'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  row: {
    gap: 10,
    paddingRight: spacing.md,
  },
  card: {
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  titleActive: {
    color: colors.navy,
  },
  meta: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.muted,
  },
  metaActive: {
    color: colors.primary,
  },
});
