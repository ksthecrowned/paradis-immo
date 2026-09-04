import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, getBootColorScheme, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMyNotifications,
  mapInboxNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotificationView,
  type NotificationKind,
} from '@/lib/inbox-notifications';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const isDark = getBootColorScheme() === 'dark';

function kindIcon(kind: NotificationKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'visit') return 'calendar-outline';
  if (kind === 'payment') return 'card-outline';
  if (kind === 'favorite') return 'heart-outline';
  return 'notifications-outline';
}

export default function NotificationsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InboxNotificationView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await listMyNotifications();
      setItems(rows.map(mapInboxNotification));
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les notifications'));
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/notifications');
        if (!active) return;
        setReady(ok);
        if (!ok) return;
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markAllRead = async (): Promise<void> => {
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, read: true })),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de tout marquer comme lu'));
    }
  };

  const openItem = async (item: InboxNotificationView): Promise<void> => {
    if (!item.read) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, read: true } : row,
        ),
      );
      void markNotificationRead(item.id).catch(() => {
        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, read: false } : row,
          ),
        );
      });
    }
    if (item.link) {
      if (item.link.params) {
        router.push({
          pathname: item.link.pathname as never,
          params: item.link.params,
        });
      } else {
        router.push(item.link.pathname as never);
      }
    }
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

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
              onPress={() => void markAllRead()}
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

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void onRefresh()} accessibilityRole="button">
            <Text style={styles.errorRetry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
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
            onPress={() => void openItem(item)}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
  errorBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  errorRetry: {
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
