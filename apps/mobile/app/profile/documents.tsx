import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  listMyDocuments,
  tenantDocTypeLabel,
  type TenantDocumentItem,
} from '@/lib/documents';
import { getErrorMessage } from '@/lib/feedback';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileDocumentsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [docs, setDocs] = useState<TenantDocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDocs(await listMyDocuments());
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les documents'));
      setDocs([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/documents');
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openPreview = (doc: TenantDocumentItem): void => {
    void Linking.openURL(doc.url);
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
      <ScreenHeader title="Mes documents" icon="document-text-outline" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void onRefresh()}
              accessibilityRole="button"
            >
              <Text style={styles.errorRetry}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {docs.length === 0 && !error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucun document</Text>
            <Text style={styles.emptySubtitle}>
              Vos pièces d’identité et justificatifs apparaîtront ici.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {docs.map((doc, index) => (
              <Pressable
                key={doc.id}
                style={[
                  styles.row,
                  index < docs.length - 1 && styles.rowBorder,
                ]}
                onPress={() => openPreview(doc)}
                accessibilityRole="button"
                accessibilityLabel={doc.name || tenantDocTypeLabel(doc.type)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name="document-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {doc.name || tenantDocTypeLabel(doc.type)}
                  </Text>
                  <Text style={styles.docMeta} numberOfLines={1}>
                    {tenantDocTypeLabel(doc.type)}
                  </Text>
                </View>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
  content: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  errorBanner: {
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
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  docMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
});
