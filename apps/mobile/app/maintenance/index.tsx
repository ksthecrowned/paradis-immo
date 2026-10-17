import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMyMaintenanceTickets,
  maintenanceStatusLabel,
  type PublicMaintenanceTicket,
} from '@/lib/maintenance';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
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

const PAGE_SIZE = 20;

export default function MaintenanceListScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<PublicMaintenanceTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0, append = false, silent = false) => {
    if (append) setLoadingMore(true);
    else if (!silent) setLoading(true);
    setError(null);
    try {
      const page = await listMyMaintenanceTickets({ limit: PAGE_SIZE, offset });
      setRows((current) => (append ? [...current, ...page.data] : page.data));
      setTotal(page.meta.total);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger vos demandes.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/maintenance');
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const refresh = (): void => {
    setRefreshing(true);
    void load(0, false, true);
  };

  const loadMore = (): void => {
    if (loadingMore || loading || rows.length >= total) return;
    void load(rows.length, true);
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
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.headerText}>
          <Text style={styles.title}>Maintenance</Text>
          <Text style={styles.subtitle}>
            {error ? 'Erreur de chargement' : `${total} demande${total === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.retry}>Réessayer</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing.lg },
          rows.length === 0 && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>Aucune demande</Text>
              <Text style={styles.subtitle}>Vos signalements apparaîtront ici.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/maintenance/${item.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.cardTop}>
              <StatusBadge
                label={maintenanceStatusLabel(item.status)}
                tone={
                  item.status === 'RESOLVED' || item.status === 'CLOSED'
                    ? 'success'
                    : item.status === 'CANCELLED'
                      ? 'danger'
                      : item.priority === 'URGENT'
                        ? 'warning'
                        : 'neutral'
                }
              />
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.priority}>Priorité · {item.priority}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} />
          ) : rows.length > 0 && rows.length < total ? (
            <Pressable style={styles.more} onPress={loadMore} accessibilityRole="button">
              <Text style={styles.retry}>Charger plus</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  headerText: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 13 },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  card: { gap: 8, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: colors.muted, fontSize: 12 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  priority: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, padding: spacing.lg },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  errorBox: { marginHorizontal: spacing.md, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface, gap: 6 },
  errorText: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.primary, fontWeight: '700' },
  more: { alignItems: 'center', padding: spacing.md },
});
