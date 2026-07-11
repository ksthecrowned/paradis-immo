import PropertyCard from '@/components/property/card';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import {
  filterByCategory,
  getCategoryMeta,
  type CategoryKey,
} from '@/lib/categories';
import { MOCK_PROPERTIES } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CategoryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string }>();
  const category = getCategoryMeta(String(key ?? ''));

  const properties = useMemo(() => {
    if (!category) return [];
    return filterByCategory(MOCK_PROPERTIES, category.key);
  }, [category]);

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
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <View style={styles.topTitles}>
          <Text style={styles.title}>{category.plural}</Text>
          <Text style={styles.subtitle}>{category.description}</Text>
        </View>
        <View style={styles.categoryIcon}>
          <Ionicons name={category.icon} size={20} color={colors.primary} />
        </View>
      </View>

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  topTitles: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
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
    color: colors.surface,
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
    color: colors.surface,
    fontWeight: '700',
  },
});

