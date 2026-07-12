import PropertyCard from '@/components/property/card';
import { colors, radii, spacing } from '@/constants/theme';
import { fetchCatalogProperty } from '@/lib/catalog';
import {
  listFavoriteIds,
} from '@/lib/favorites';
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

export default function FavoritesScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const ids = await listFavoriteIds();
      const rows = await Promise.all(
        ids.map(async (id) => {
          try {
            return await fetchCatalogProperty(id);
          } catch {
            return null;
          }
        }),
      );
      setProperties(rows.filter((item): item is Property => item != null));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites]),
  );

  const handleRefresh = (): void => {
    setRefreshing(true);
    void loadFavorites({ soft: true });
  };

  const handleFavoriteChange = (propertyId: string, favorited: boolean): void => {
    if (favorited) return;
    setProperties((current) => current.filter((item) => item.id !== propertyId));
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Mes favoris</Text>
        <Text style={styles.subtitle}>
          {loading
            ? 'Chargement…'
            : properties.length === 0
              ? 'Aucun bien enregistré'
              : `${properties.length} bien${properties.length > 1 ? 's' : ''} sauvegardé${properties.length > 1 ? 's' : ''}`}
        </Text>
      </View>

      {loading && properties.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: insets.bottom + spacing.lg,
            },
            properties.length === 0 && styles.listEmptyContent,
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
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="heart-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Pas encore de favoris</Text>
              <Text style={styles.emptySubtitle}>
                Touchez le cœur sur un bien pour le retrouver ici facilement.
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
          }
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              variant="compact"
              initialFavorited
              onPress={() => router.push(`/property/${item.id}`)}
              onFavoriteChange={(favorited) =>
                handleFavoriteChange(item.id, favorited)
              }
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
