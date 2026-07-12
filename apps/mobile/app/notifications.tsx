import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, getBootColorScheme, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isDark = getBootColorScheme() === 'dark';

type NotificationKind = 'visit' | 'payment' | 'favorite' | 'info';

type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: '1',
    kind: 'visit',
    title: 'Visite confirmée',
    body: 'Votre visite de Villa Whispering Pines est prévue demain à 10h.',
    time: 'Il y a 2 h',
    read: false,
  },
  {
    id: '2',
    kind: 'payment',
    title: 'Paiement reçu',
    body: 'Le reçu de votre réservation à Tié-Tié est disponible.',
    time: 'Hier',
    read: false,
  },
  {
    id: '3',
    kind: 'favorite',
    title: 'Nouveau bien près de vous',
    body: 'Un appartement à Centre-ville correspond à vos favoris.',
    time: 'Il y a 2 j',
    read: true,
  },
  {
    id: '4',
    kind: 'info',
    title: 'Bienvenue sur Paradis Immo',
    body: 'Explorez, réservez une visite et gérez vos locations en un seul endroit.',
    time: 'Il y a 5 j',
    read: true,
  },
];

function kindIcon(kind: NotificationKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'visit') return 'calendar-outline';
  if (kind === 'payment') return 'card-outline';
  if (kind === 'favorite') return 'heart-outline';
  return 'notifications-outline';
}

export default function NotificationsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const markAllRead = (): void => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  };

  const openItem = (id: string): void => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Tout est à jour'
        }
        icon="notifications-outline"
        trailing={
          unreadCount > 0 ? (
            <Pressable
              onPress={markAllRead}
              hitSlop={8}
              style={styles.markAllBtn}
              accessibilityRole="button"
              accessibilityLabel="Tout marquer comme lu"
            >
              <Text style={styles.markAll}>Tout lu</Text>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.lg },
          items.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="notifications-outline"
                size={28}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptySubtitle}>
              Vos alertes et messages apparaîtront ici.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => openItem(item.id)}
            accessibilityRole="button"
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={kindIcon(item.kind)}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.cardBodyText} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.cardTime}>{item.time}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAll: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    borderColor: isDark ? 'rgba(112, 101, 240, 0.45)' : colors.primarySoft,
    backgroundColor: isDark ? 'rgba(112, 101, 240, 0.12)' : colors.primaryMuted,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: isDark ? colors.bg : colors.primaryMuted,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  cardBodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  cardTime: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: isDark ? colors.surface : colors.primaryMuted,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
});
