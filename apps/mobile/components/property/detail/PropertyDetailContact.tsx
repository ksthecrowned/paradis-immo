import { StarRating } from '@/components/agency/StarRating';
import { colors, radii, spacing } from '@/constants/theme';
import { getAgency, getAgent } from '@/lib/agencies';
import { formatDate } from '@/lib/format';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  property: Property;
};

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return letters || 'PI';
}

function callPhone(phone: string): void {
  void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
}

export function PropertyDetailContact({
  property,
}: Props): React.JSX.Element | null {
  const agency = getAgency(property.agencyId);
  const agent = getAgent(property.agentId);

  const agencyName = agency?.shortName ?? agency?.name ?? property.agencyName;
  const showAgency = Boolean(agencyName);

  const agentName = agent?.displayName ?? property.agentName ?? null;
  const showAgent = Boolean(agentName || property.agentPhone);

  if (!showAgency && !showAgent) return null;

  const updatedLabel = property.updatedAt
    ? `Mis à jour le ${formatDate(property.updatedAt)}`
    : null;

  const agentPhone = agent?.phone || property.agentPhone || null;
  const agencyPhone = agency?.phone?.trim() || null;
  const agencyAddress = agency?.address?.trim() || null;
  const showRating =
    agency != null && agency.rating > 0 && agency.reviewCount > 0;

  const agentInitials =
    agent?.initials || (agentName ? initialsFromName(agentName) : 'PI');
  const agentRole = agent?.role ?? 'Conseiller';
  const agentSpecialty = agent
    ? `${agent.specialty} · ${agent.yearsExperience} ans d’exp.`
    : null;

  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionTitle}>Contact</Text>
      <Text style={styles.sectionSubtitle}>
        Agence et conseiller en charge de ce bien
      </Text>

      {showAgency ? (
        <View style={styles.card}>
          <View
            style={[
              styles.logo,
              { backgroundColor: agency?.logoColor ?? colors.primary },
            ]}
          >
            <Text style={styles.logoText}>
              {initialsFromName(agencyName!)}
            </Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {agencyName}
            </Text>
            {agencyAddress ? (
              <Text style={styles.cardMeta} numberOfLines={2}>
                {agencyAddress}
              </Text>
            ) : null}
            {showRating ? (
              <View style={styles.ratingRow}>
                <StarRating rating={agency!.rating} size={12} />
                <Text style={styles.ratingText}>
                  {agency!.rating.toFixed(1)} · {agency!.reviewCount} avis
                </Text>
              </View>
            ) : null}
            {agencyPhone ? (
              <Pressable
                onPress={() => callPhone(agencyPhone)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Appeler ${agencyName}`}
                style={styles.phoneRow}
              >
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.phoneLink}>{agencyPhone}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push(`/agency/${property.agencyId}`)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Voir l’agence ${agencyName}`}
            >
              <Text style={styles.agencyLink}>Voir l’agence</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showAgent ? (
        <View style={styles.card}>
          <View
            style={[
              styles.logo,
              { backgroundColor: agency?.logoColor ?? colors.primary },
            ]}
          >
            <Text style={styles.logoText}>{agentInitials}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {agentName ?? 'Conseiller'}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {agentRole}
            </Text>
            {agentSpecialty ? (
              <Text style={styles.cardMeta} numberOfLines={1}>
                {agentSpecialty}
              </Text>
            ) : null}
            {agentPhone ? (
              <Pressable
                onPress={() => callPhone(agentPhone)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Appeler ${agentName ?? 'le conseiller'}`}
                style={styles.phoneRow}
              >
                <Ionicons
                  name="call-outline"
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.phoneLink}>{agentPhone}</Text>
              </Pressable>
            ) : null}
            {updatedLabel ? (
              <Text style={styles.updated}>{updatedLabel}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 10,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    marginTop: -4,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.surface,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  cardMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  phoneLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  agencyLink: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  updated: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
});
