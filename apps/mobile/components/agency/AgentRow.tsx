import { colors, radii, spacing } from '@/constants/theme';
import { getAgency, getAgent } from '@/lib/mock-agencies';
import { listPropertiesByAgent } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

export function AgentRow({
  agentId,
  fallbackName,
  fallbackPhone,
  showAgencyLink = false,
  showListingCount = false,
  showPhone = false,
  compact = false,
  onPressAgency,
  onPress,
}: {
  agentId: string;
  fallbackName?: string;
  fallbackPhone?: string | null;
  showAgencyLink?: boolean;
  showListingCount?: boolean;
  showPhone?: boolean;
  /** Tighter row for sheets / lists. */
  compact?: boolean;
  onPressAgency?: () => void;
  onPress?: () => void;
}): React.JSX.Element | null {
  const agent = getAgent(agentId);
  const name = agent?.name ?? fallbackName ?? 'Conseiller Paradis Immo';
  const phone = agent?.phone ?? fallbackPhone ?? null;
  const agency = agent ? getAgency(agent.agencyId) : null;
  const listingCount =
    showListingCount && agent
      ? listPropertiesByAgent(agent.id).length
      : 0;

  const handleAgency = (): void => {
    if (onPressAgency) {
      onPressAgency();
      return;
    }
    if (agent) router.push(`/agency/${agent.agencyId}`);
  };

  const handleCall = (): void => {
    if (!phone) return;
    void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const initials = agent?.initials
    ?? name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
    || 'PI';
  const role = agent?.role ?? 'Conseiller';
  const specialty = agent
    ? `${agent.specialty} · ${agent.yearsExperience} ans d’exp.`
    : 'Accompagnement locatif et vente';

  const body = (
    <>
      <View
        style={[
          styles.avatar,
          compact && styles.avatarCompact,
          { backgroundColor: agency?.logoColor ?? colors.primary },
        ]}
      >
        <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>
          {initials}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {role}
          {agency ? ` · ${agency.shortName}` : ''}
        </Text>
        {!compact ? (
          <Text style={styles.specialty} numberOfLines={1}>
            {specialty}
          </Text>
        ) : null}
        {showListingCount ? (
          <Text style={styles.count}>
            {listingCount} bien{listingCount > 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>
      {showPhone && phone ? (
        <Pressable
          style={styles.iconBtn}
          onPress={handleCall}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Appeler ${name}`}
        >
          <Ionicons name="call-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : null}
      {showAgencyLink ? (
        <Pressable
          onPress={handleAgency}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voir l’agence"
        >
          <Text style={styles.link}>Agence</Text>
        </Pressable>
      ) : null}
      {onPress && !showAgencyLink ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.row, compact && styles.rowCompact]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${role}`}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[styles.row, compact && styles.rowCompact]}>{body}</View>;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.sm,
  },
  rowCompact: {
    minHeight: 56,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCompact: {
    width: 44,
    height: 44,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.surface,
  },
  avatarTextCompact: {
    fontSize: 13,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  nameCompact: {
    fontSize: 15,
    fontWeight: '700',
  },
  role: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  specialty: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  count: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
