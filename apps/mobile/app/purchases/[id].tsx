import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { formatDateFr } from '@/lib/format-date-fr';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMySaleInquiries,
  saleInquiryStatusLabel,
  saleInquiryStatusTone,
  type PublicSaleInquiry,
} from '@/lib/sales';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = ['NEW', 'CONTACTED', 'VISIT_SCHEDULED', 'CLOSED'] as const;

export default function PurchaseDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const purchaseId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inquiry, setInquiry] = useState<PublicSaleInquiry | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listMySaleInquiries();
      const found = rows.find((r) => r.id === purchaseId) ?? null;
      setInquiry(found);
      if (found) {
        setProperty(await fetchCatalogProperty(found.propertyId));
      } else {
        setProperty(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le dossier'));
      setInquiry(null);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/purchases/${purchaseId}`,
        );
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [purchaseId, load]),
  );

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !inquiry || !property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>{error ?? 'Dossier introuvable'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const stepIndex = Math.max(
    0,
    STEPS.indexOf(inquiry.status as (typeof STEPS)[number]),
  );
  const phone = property.agentPhone;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Achat</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <View style={styles.hero}>
          <StatusBadge
            label={saleInquiryStatusLabel(inquiry.status)}
            tone={saleInquiryStatusTone(inquiry.status)}
          />
          <Text style={styles.title}>{property.title}</Text>
          <Text style={styles.location}>{property.location}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parcours</Text>
          {STEPS.map((step, index) => {
            const done = index <= stepIndex;
            return (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.dot, done && styles.dotDone]} />
                <Text style={[styles.stepLabel, done && styles.stepDone]}>
                  {saleInquiryStatusLabel(step)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Demande</Text>
          <Text style={styles.body}>
            {inquiry.message?.trim() || 'Sans message'}
          </Text>
          <Text style={styles.meta}>
            Créée le {formatDateFr(inquiry.createdAt)}
          </Text>
        </View>

        {(property.agencyName || phone) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agence</Text>
            <Text style={styles.body}>
              {property.agencyName ?? 'Agence'}
              {property.agentName ? ` · ${property.agentName}` : ''}
            </Text>
            {phone ? (
              <Pressable
                style={styles.contactBtn}
                onPress={() => void Linking.openURL(`tel:${phone}`)}
              >
                <Ionicons name="call-outline" size={18} color={colors.surface} />
                <Text style={styles.contactText}>Contacter</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push(`/property/${property.id}`)}
        >
          <Text style={styles.secondaryText}>Voir l’annonce</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  missing: { fontSize: 16, fontWeight: '700', color: colors.ink },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 44 },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  hero: { gap: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  location: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  card: {
    gap: 10,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotDone: { backgroundColor: colors.primary },
  stepLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  stepDone: { color: colors.ink, fontWeight: '700' },
  body: { fontSize: 14, color: colors.ink, fontWeight: '500', lineHeight: 20 },
  meta: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  contactBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactText: { fontSize: 14, fontWeight: '700', color: colors.surface },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: colors.ink },
});
