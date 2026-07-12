import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { colors, radii } from '@/constants/theme';
import { formatDateFr, formatDueLabel } from '@/lib/format-date-fr';
import {
  portfolioRelationLabel,
  type PortfolioItem,
  type PortfolioRelation,
} from '@/lib/portfolio';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

function relationTone(relation: PortfolioRelation): StatusTone {
  switch (relation) {
    case 'tenant':
      return 'success';
    case 'purchase_active':
      return 'warning';
    case 'purchase_owned':
      return 'success';
    case 'stay':
      return 'warning';
    case 'visit':
    default:
      return 'neutral';
  }
}

type Props = {
  item: PortfolioItem;
  property: Property | undefined;
  onPress: () => void;
};

export function PortfolioPropertyCard({
  item,
  property,
  onPress,
}: Props): React.JSX.Element {
  const dueLine =
    item.primaryRelation === 'tenant' && item.nextDue
      ? formatDueLabel(item.nextDue.dueDate)
      : null;

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={property?.title ?? 'Bien'}
    >
      {property?.coverImage ? (
        <Image
          source={{ uri: property.coverImage }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="home-outline" size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.body}>
        <StatusBadge
          label={portfolioRelationLabel(item.primaryRelation)}
          tone={relationTone(item.primaryRelation)}
        />
        <Text style={styles.title} numberOfLines={1}>
          {property?.title ?? 'Bien'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {property?.location ?? 'Congo'}
        </Text>
        {dueLine ? (
          <Text style={styles.due} numberOfLines={1}>
            Échéance · {dueLine}
          </Text>
        ) : (
          <Text style={styles.activity} numberOfLines={1}>
            Dernière activité · {formatDateFr(item.lastAt)}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  due: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  activity: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
});
