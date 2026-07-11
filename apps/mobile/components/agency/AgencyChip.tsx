import { colors, radii } from '@/constants/theme';
import { getAgency } from '@/lib/mock-agencies';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AgencyChip({
  agencyId,
  onPress,
}: {
  agencyId: string;
  onPress?: () => void;
}): React.JSX.Element | null {
  const agency = getAgency(agencyId);
  if (!agency) return null;

  const handlePress = (): void => {
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/agency/${agency.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={`Agence ${agency.name}`}
    >
      <View style={[styles.dot, { backgroundColor: agency.logoColor }]}>
        <Text style={styles.dotText}>{agency.shortName.slice(0, 1)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {agency.shortName}
      </Text>
      {agency.isOfficial ? (
        <View style={styles.official}>
          <Text style={styles.officialText}>Officiel</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontSize: 11, fontWeight: '800', color: colors.surface },
  label: { fontSize: 12, fontWeight: '700', color: colors.ink, maxWidth: 120 },
  official: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  officialText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.surface,
  },
});
