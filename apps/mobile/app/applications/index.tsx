import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  canWithdrawApplication,
  listMyRentalApplications,
  rentalApplicationStatusLabel,
  withdrawRentalApplication,
  type PublicRentalApplication,
} from '@/lib/applications';
import { getErrorMessage } from '@/lib/feedback';
import { formatDateFr } from '@/lib/format-date-fr';
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

export default function RentalApplicationsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<PublicRentalApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await listMyRentalApplications());
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger vos candidatures.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/applications');
        if (!active) return;
        setReady(ok);
        if (ok) {
          setLoading(true);
          await load();
        }
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const withdraw = (application: PublicRentalApplication): void => {
    showFeedback({
      type: 'warning',
      title: 'Retirer la candidature ?',
      message: 'Cette action mettra fin au suivi de cette demande.',
      buttons: [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            setBusyId(application.id);
            void withdrawRentalApplication(application.id)
              .then(() => load())
              .catch((err: unknown) => {
                showFeedback({
                  type: 'error',
                  title: 'Retrait impossible',
                  message: getErrorMessage(err, 'La candidature reste active.'),
                });
              })
              .finally(() => setBusyId(null));
          },
        },
      ],
    });
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

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
        <Text style={styles.title}>Mes candidatures</Text>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void refresh()} accessibilityRole="button">
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
          rows.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={38} color={colors.muted} />
              <Text style={styles.emptyTitle}>Aucune candidature</Text>
              <Text style={styles.muted}>Vos demandes de location apparaîtront ici.</Text>
              <Pressable onPress={() => router.push('/search')} style={styles.explore}>
                <Text style={styles.exploreText}>Explorer les biens</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <StatusBadge
                label={rentalApplicationStatusLabel(item.status)}
                tone={
                  item.status === 'ACCEPTED'
                    ? 'success'
                    : item.status === 'REJECTED' || item.status === 'WITHDRAWN'
                      ? 'danger'
                      : item.status === 'SOLVENCY_PENDING'
                        ? 'warning'
                        : 'neutral'
                }
              />
              <Text style={styles.date}>{formatDateFr(item.createdAt)}</Text>
            </View>
            <Text style={styles.propertyTitle}>
              {item.property?.title ?? 'Annonce de location'}
            </Text>
            <Text style={styles.muted}>
              Emménagement souhaité · {formatDateFr(item.desiredMoveIn)}
            </Text>
            {item.rejectionMessage ? (
              <Text style={styles.rejection}>{item.rejectionMessage}</Text>
            ) : null}
            {item.status === 'SOLVENCY_PENDING' ? (
              <Pressable
                style={styles.secondary}
                onPress={() => router.push('/cahier-loyer/solvency')}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryText}>Répondre à la demande de solvabilité</Text>
              </Pressable>
            ) : null}
            {canWithdrawApplication(item.status) ? (
              <Pressable
                style={styles.withdraw}
                onPress={() => withdraw(item)}
                disabled={busyId === item.id}
                accessibilityRole="button"
              >
                <Text style={styles.withdrawText}>
                  {busyId === item.id ? 'Retrait…' : 'Retirer la candidature'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { flex: 1, fontSize: 21, fontWeight: '800', color: colors.ink },
  list: { paddingHorizontal: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { color: colors.muted, fontSize: 12 },
  propertyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted },
  rejection: { color: colors.danger, fontSize: 13 },
  secondary: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryText: { color: colors.primary, fontWeight: '700', textAlign: 'center' },
  withdraw: { alignSelf: 'flex-start', paddingVertical: 8 },
  withdrawText: { color: colors.danger, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, padding: spacing.lg },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  explore: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.full, backgroundColor: colors.primary },
  exploreText: { color: colors.onPrimary, fontWeight: '700' },
  errorBox: { marginHorizontal: spacing.md, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface, gap: 6 },
  errorText: { color: colors.danger, fontSize: 13 },
  retry: { color: colors.primary, fontWeight: '700' },
});
