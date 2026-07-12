import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  bookingStatusLabel,
  bookingStatusTone,
  listMyBookings,
  type PublicBooking,
} from '@/lib/bookings';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import { formatDateFr } from '@/lib/format-date-fr';
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

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

function nightsBetween(start: string, end: string): number {
  const a = new Date(start.slice(0, 10));
  const b = new Date(end.slice(0, 10));
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export default function StayDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stayId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stay, setStay] = useState<PublicBooking | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bookings = await listMyBookings();
      const found = bookings.find((b) => b.id === stayId) ?? null;
      setStay(found);
      if (found) {
        setProperty(await fetchCatalogProperty(found.propertyId));
      } else {
        setProperty(null);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger le séjour'));
      setStay(null);
    } finally {
      setLoading(false);
    }
  }, [stayId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/stays/${stayId}`);
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [stayId, load]),
  );

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !stay || !property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>{error ?? 'Séjour introuvable'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const nights = nightsBetween(stay.startDate, stay.endDate);
  const phone = property.agentPhone;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Séjour</Text>
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
            label={bookingStatusLabel(stay.status)}
            tone={bookingStatusTone(stay.status)}
          />
          <Text style={styles.title}>{property.title}</Text>
          <Text style={styles.location}>{property.location}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dates</Text>
          <Row label="Arrivée" value={formatDateFr(stay.startDate)} />
          <Row label="Départ" value={formatDateFr(stay.endDate)} />
          <Row label="Nuits" value={`${nights}`} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paiement</Text>
          <Text style={styles.amount}>
            {formatFcfa(Number(stay.totalPrice))}
          </Text>
          <Text style={styles.hint}>Total séjour · location journalière</Text>
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

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: colors.ink },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  amount: { fontSize: 24, fontWeight: '800', color: colors.primary },
  hint: { fontSize: 13, color: colors.muted },
  body: { fontSize: 14, color: colors.ink, fontWeight: '500' },
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
