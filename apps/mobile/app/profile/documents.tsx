import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { StatusTone } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  documentStatusLabel,
  listMockDocuments,
  type DocumentStatus,
  type MockTenantDocument,
} from '@/lib/mock-documents';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function toneFor(status: DocumentStatus): StatusTone {
  if (status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'danger';
}

export default function ProfileDocumentsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const [ready, setReady] = useState(false);
  const docs = useMemo(() => listMockDocuments(), []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/profile/documents');
        if (active) setReady(ok);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const openPreview = (doc: MockTenantDocument): void => {
    showFeedback({
      type: 'info',
      title: doc.title,
      message: doc.previewHint,
    });
  };

  if (!ready) {
    return <View style={styles.screen} />;
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
        <Text style={styles.topTitle}>Mes documents</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
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
            >
              <View style={styles.icon}>
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.main}>
                <Text style={styles.title}>{doc.title}</Text>
                <StatusBadge
                  label={documentStatusLabel(doc.status)}
                  tone={toneFor(doc.status)}
                />
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() =>
            showFeedback({
              type: 'info',
              title: 'Bientôt',
              message: 'L’ajout de documents sera disponible prochainement.',
            })
          }
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addText}>Ajouter un document</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 44 },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
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
  icon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
