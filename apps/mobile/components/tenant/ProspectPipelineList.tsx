import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import type {
  ActivityItem,
  ProspectSection,
} from '@/lib/mock-activity';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  sections: ProspectSection[];
  onItemPress: (item: ActivityItem) => void;
};

export function ProspectPipelineList({
  sections,
  onItemPress,
}: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.length === 0 ? (
            <Text style={styles.empty}>Rien pour le moment</Text>
          ) : (
            section.items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.card}
                onPress={() => onItemPress(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.statusLabel}`}
              >
                <View style={styles.cardTop}>
                  <StatusBadge label={item.statusLabel} tone={item.tone} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.meta}
                  </Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={13} color={colors.muted} />
                  <Text style={styles.location} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  empty: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
});
