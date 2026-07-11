import { colors, radii } from '@/constants/theme';
import { getAgency } from '@/lib/agencies';
import { Octicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AgencyChip({
  agencyId,
  fallbackLabel,
  onPress,
}: {
  agencyId: string;
  fallbackLabel?: string;
  onPress?: () => void;
}): React.JSX.Element {
  const agency = getAgency(agencyId);
  const shortName =
    (agency?.shortName ?? fallbackLabel?.trim()) || 'Agence';
  const name = agency?.name ?? shortName;
  const logoColor = agency?.logoColor ?? '#7065F0';
  const isOfficial = agency?.isOfficial === true;

  const handlePress = (): void => {
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/agency/${agencyId}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={`Agence ${name}`}
    >
      <View style={[styles.dot, { backgroundColor: logoColor }]}>
        <Text style={styles.dotText}>{shortName.slice(0, 1)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {shortName}
      </Text>
      {isOfficial ? (
        <View style={styles.official}>
          <Octicons name="verified" size={16} color="#0083ff" />
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
    padding: 4,
  },
});
