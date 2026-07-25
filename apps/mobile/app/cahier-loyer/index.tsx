import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import { listMyLeases, type PublicLease } from '@/lib/leases';
import { listMySolvencyChecks } from '@/lib/solvency';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type HubRow = {
  lease: PublicLease;
  title: string;
};

export default function CahierLoyerHubScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<HubRow[]>([]);
  const [pendingSolvency, setPendingSolvency] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [leases, checks] = await Promise.all([
        listMyLeases(),
        listMySolvencyChecks().catch(() => []),
      ]);
      setPendingSolvency(checks.filter((c) => c.status === 'PENDING').length);
      const active = leases.filter((l) => l.status === 'ACTIVE');
      if (active.length === 1) {
        router.replace(`/portfolio/${active[0]!.propertyId}/rent`);
        return;
      }
      const withTitles = await Promise.all(
        active.map(async (lease) => {
          try {
            const property = await fetchCatalogProperty(lease.propertyId);
            return { lease, title: property.title };
          } catch {
            return { lease, title: `Bien ${lease.propertyId.slice(0, 8)}…` };
          }
        }),
      );
      setRows(withTitles);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le cahier'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/cahier-loyer');
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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <CircleIconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </CircleIconButton>

        <Text style={styles.title}>Mon cahier de loyer</Text>
        <Text style={styles.subtitle}>
          Suivez vos échéances et paiements par bien.
        </Text>

        <Pressable
          style={styles.solvencyLink}
          onPress={() => router.push('/cahier-loyer/solvency')}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.solvencyLinkText}>Demandes de solvabilité</Text>
          {pendingSolvency > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingSolvency}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun bail actif</Text>
            <Text style={styles.emptyBody}>
              Quand un bail sera activé, votre cahier de loyer apparaîtra ici.
            </Text>
          </View>
        ) : (
          rows.map(({ lease, title }) => (
            <Pressable
              key={lease.id}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                router.push(`/portfolio/${lease.propertyId}/rent`)
              }
            >
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardMeta}>
                  {Number(lease.monthlyRent).toLocaleString('fr-FR')}{' '}
                  {lease.currency} / mois
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: { fontSize: 14, fontWeight: '500', color: colors.muted },
  solvencyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  solvencyLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14 },
  empty: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  cardPressed: { opacity: 0.85 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.muted },
});
