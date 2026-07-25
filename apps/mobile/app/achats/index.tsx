import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMySaleAgreements,
  nextPayableInstallment,
  saleAgreementStatusLabel,
  type PublicSaleAgreement,
} from '@/lib/sale-agreements';
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

function formatMoney(amount: string, currency: string): string {
  return `${Number(amount).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} ${currency}`;
}

export default function AchatsHubScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PublicSaleAgreement[]>([]);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const all = await listMySaleAgreements();
      const visible = all.filter((a) => a.status !== 'DRAFT');
      setRows(visible);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger vos achats'));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/achats');
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  if (!ready) {
    return <View style={styles.screen} />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Mes achats</Text>
        <View style={styles.spacer} />
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing.lg },
            rows.length === 0 && styles.listEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ soft: true });
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>Aucun dossier actif</Text>
                  <Text style={styles.emptySubtitle}>
                    Quand un vendeur ouvrira un dossier de vente par paliers,
                    il apparaîtra ici.
                  </Text>
                </>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <AgreementCard row={item} />}
        />
      )}
    </View>
  );
}

function AgreementCard({
  row,
}: {
  row: PublicSaleAgreement;
}): React.JSX.Element {
  const next = nextPayableInstallment(row.installments);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/achats/${row.id}`)}
      accessibilityRole="button"
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{row.propertyTitle}</Text>
        <Text style={styles.cardMeta}>
          {formatMoney(row.agreedPrice, row.currency)}
        </Text>
        {next ? (
          <Text style={styles.cardNext}>
            Prochain palier ·{' '}
            {formatMoney(next.amount, next.currency)}
          </Text>
        ) : null}
      </View>
      <StatusBadge
        label={saleAgreementStatusLabel(row.status)}
        tone={
          row.status === 'ACTIVE'
            ? 'success'
            : row.status === 'CANCELLED'
              ? 'danger'
              : 'neutral'
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  spacer: { width: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 14, fontWeight: '600', color: colors.muted },
  cardNext: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
