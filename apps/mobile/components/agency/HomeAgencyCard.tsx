import { colors, radii, spacing } from '@/constants/theme';
import type { Agency } from '@/lib/agencies';
import { router } from 'expo-router';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const AGENCY_COVERS: ImageSourcePropType[] = [
  require('@/assets/images/house1.jpg'),
  require('@/assets/images/house2.jpg'),
  require('@/assets/images/house4.jpg'),
  require('@/assets/images/house5.jpg'),
  require('@/assets/images/house6.jpg'),
];

function coverForAgency(id: string): ImageSourcePropType {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i)) % AGENCY_COVERS.length;
  }
  return AGENCY_COVERS[hash]!;
}

type Props = {
  agency: Agency;
  onPress?: () => void;
};

export function HomeAgencyCard({
  agency,
  onPress,
}: Props): React.JSX.Element {
  const handlePress = (): void => {
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/agency/${agency.id}`);
  };

  const title = agency.shortName || agency.name;
  const subtitle =
    agency.tagline?.trim() ||
    (agency.city ? `Agence à ${agency.city}` : 'Agence immobilière');

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Agence ${agency.name}`}
    >
      <View style={styles.imageWrap}>
        <Image
          source={coverForAgency(agency.id)}
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Voir l’agence</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  imageWrap: {
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: 128,
  },
  body: {
    gap: 6,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.muted,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
