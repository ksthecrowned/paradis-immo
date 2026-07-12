import PropertyCard from '@/components/property/card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { fetchCatalogProperties } from '@/lib/catalog';
import {
  filterByCategory,
  getCategoryMeta,
  type CategoryKey,
} from '@/lib/categories';
import { getErrorMessage } from '@/lib/feedback';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string }>();
  const category = getCategoryMeta(String(key ?? ''));
  const [catalog, setCatalog] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const rows = await fetchCatalogProperties({ limit: 50 });
          if (active) setCatalog(rows);
        } catch (err) {
          if (active) {
            setError(getErrorMessage(err, 'Impossible de charger les biens'));
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const properties = useMemo(() => {
    if (!category) return [];
    return filterByCategory(catalog, category.key as CategoryKey);
  }, [category, catalog]);

  if (!category) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.missingTitle}>Catégorie introuvable</Text>
        <Pressable
          style={styles.missingBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={category.plural}
        subtitle={category.description}
        icon={category.icon}
      />

      <FlatList
        data={properties}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.lg },
          properties.length === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <Text style={styles.count}>
            {properties.length} bien{properties.length > 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={category.icon} size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>Aucun bien pour l’instant</Text>
            <Text style={styles.emptySubtitle}>
              Revenez bientôt — de nouvelles annonces arrivent régulièrement.
            </Text>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.push('/search')}
              accessibilityRole="button"
            >
              <Text style={styles.emptyCtaText}>Rechercher</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <PropertyCard
            horizontalSpacing={true}
            property={item}
            onPress={() => router.push(`/property/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

/** Type helper for route params. */
export type CategoryRouteKey = CategoryKey;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  listEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: spacing.md,
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 48,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyCta: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  missingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
