import { colors, radii, spacing } from '@/constants/theme';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AgentRow({
  agentId,
  showAgencyLink = false,
  onPressAgency,
  onPress,
}: {
  agentId: string;
  showAgencyLink?: boolean;
  onPressAgency?: () => void;
  onPress?: () => void;
}): React.JSX.Element | null {
  const agent = getAgent(agentId);
  if (!agent) return null;
  const agency = getAgency(agent.agencyId);

  const handleAgency = (): void => {
    if (onPressAgency) {
      onPressAgency();
      return;
    }
    router.push(`/agency/${agent.agencyId}`);
  };

  const body = (
    <>
      <View
        style={[
          styles.avatar,
          { backgroundColor: agency?.logoColor ?? colors.primary },
        ]}
      >
        <Text style={styles.avatarText}>{agent.initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {agent.displayName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {agency?.shortName ?? 'Agence'}
        </Text>
      </View>
      {showAgencyLink ? (
        <Pressable
          onPress={handleAgency}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voir l’agence"
        >
          <Text style={styles.link}>Voir l’agence</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={styles.row}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${agent.displayName}, ${agency?.shortName ?? 'agence'}`}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.row}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.surface,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
