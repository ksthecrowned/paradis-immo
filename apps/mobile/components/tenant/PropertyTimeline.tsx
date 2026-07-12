import { colors, radii } from '@/constants/theme';
import { formatDateFr } from '@/lib/format-date-fr';
import type { TimelineEvent } from '@/lib/portfolio';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const KIND_ICON: Record<
  TimelineEvent['kind'],
  keyof typeof Ionicons.glyphMap
> = {
  visit: 'eye-outline',
  stay: 'bed-outline',
  purchase: 'home-outline',
  lease: 'document-text-outline',
  rent: 'cash-outline',
};

type Props = {
  events: TimelineEvent[];
  onEventPress: (event: TimelineEvent) => void;
};

export function PropertyTimeline({
  events,
  onEventPress,
}: Props): React.JSX.Element {
  if (events.length === 0) {
    return (
      <Text style={styles.empty}>Aucun historique pour ce bien.</Text>
    );
  }

  return (
    <View style={styles.list}>
      {events.map((event) => {
        const pressable =
          event.stayId != null ||
          event.purchaseId != null ||
          event.leaseId != null;
        const content = (
          <>
            <View style={styles.iconWrap}>
              <Ionicons
                name={KIND_ICON[event.kind]}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{event.title}</Text>
              <Text style={styles.date}>{formatDateFr(event.at)}</Text>
              {event.meta ? (
                <Text style={styles.meta} numberOfLines={2}>
                  {event.meta}
                </Text>
              ) : null}
            </View>
            {pressable ? (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.muted}
              />
            ) : null}
          </>
        );

        if (!pressable) {
          return (
            <View key={event.id} style={styles.row}>
              {content}
            </View>
          );
        }

        return (
          <Pressable
            key={event.id}
            style={styles.row}
            onPress={() => onEventPress(event)}
            accessibilityRole="button"
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
});
