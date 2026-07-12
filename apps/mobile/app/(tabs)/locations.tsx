import { PortfolioPropertyCard } from '@/components/tenant/PortfolioPropertyCard';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import {
  fetchPortfolioProperties,
  type PortfolioItem,
} from '@/lib/portfolio';
import type { Property } from '@/types/property';
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

export default function LocationsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [properties, setProperties] = useState<Record<string, Property>>({});

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const portfolio = await fetchPortfolioProperties();
      setItems(portfolio);
      const entries = await Promise.all(
        portfolio.map(async (item) => {
          try {
            const property = await fetchCatalogProperty(item.propertyId);
            return [item.propertyId, property] as const;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<string, Property> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setProperties(map);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger vos biens'));
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/(tabs)/locations');
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const handleRefresh = (): void => {
    setRefreshing(true);
    void load({ soft: true });
  };

  if (!ready) {
    return <View style={styles.screen} />;
  }

  const subtitle = loading
    ? 'Chargement…'
    : error
      ? 'Erreur de chargement'
      : items.length === 0
        ? 'Aucun bien pour l’instant'
        : `${items.length} bien${items.length > 1 ? 's' : ''} · visites, séjours, achats, loyers`;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Mes biens</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={error ? [] : items}
          keyExtractor={(item) => item.propertyId}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.lg },
            (error || items.length === 0) && styles.listEmptyContent,
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={32}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>Impossible de charger</Text>
                <Text style={styles.emptySubtitle}>{error}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyCta,
                    pressed && styles.emptyCtaPressed,
                  ]}
                  onPress={() => void load()}
                  accessibilityRole="button"
                  accessibilityLabel="Réessayer"
                >
                  <Text style={styles.emptyCtaText}>Réessayer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name="business-outline"
                    size={32}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.emptyTitle}>Pas encore de biens</Text>
                <Text style={styles.emptySubtitle}>
                  Réservez une visite, un séjour ou démarrez un achat pour les
                  retrouver ici.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.emptyCta,
                    pressed && styles.emptyCtaPressed,
                  ]}
                  onPress={() => router.push('/search')}
                  accessibilityRole="button"
                  accessibilityLabel="Explorer les biens"
                >
                  <Text style={styles.emptyCtaText}>Explorer les biens</Text>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PortfolioPropertyCard
              item={item}
              property={properties[item.propertyId]}
              onPress={() => {
                if (item.activeLease) {
                  router.push(`/portfolio/${item.propertyId}/rent`);
                } else {
                  router.push(`/portfolio/${item.propertyId}`);
                }
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  listEmptyContent: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaPressed: {
    backgroundColor: colors.primaryHover,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
