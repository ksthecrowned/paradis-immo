import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type SetupPermissionPanelProps = {
  icon: keyof typeof Ionicons.glyphMap;
  heading: string;
  body: string;
  status?: 'idle' | 'granted' | 'denied';
};

export function SetupPermissionPanel({
  icon,
  heading,
  body,
  status = 'idle',
}: SetupPermissionPanelProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.body}>{body}</Text>
      {status === 'granted' ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.badgeText, { color: colors.success }]}>
            Autorisé
          </Text>
        </View>
      ) : null}
      {status === 'denied' ? (
        <View style={styles.badge}>
          <Ionicons name="close-circle" size={16} color={colors.muted} />
          <Text style={styles.badgeText}>Refusé pour l’instant</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
});
