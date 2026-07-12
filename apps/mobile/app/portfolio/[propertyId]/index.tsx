import { PropertyTimeline } from '@/components/tenant/PropertyTimeline';
import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import {
  fetchPropertyTimeline,
  type TimelineEvent,
} from '@/lib/portfolio';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PortfolioTimelineScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const id = String(propertyId ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prop, timeline] = await Promise.all([
        fetchCatalogProperty(id),
        fetchPropertyTimeline(id),
      ]);
      setProperty(prop);
      setEvents(timeline);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger l’historique'));
      setProperty(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/portfolio/${id}`);
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [id, load]),
  );

  const onEventPress = (event: TimelineEvent): void => {
    if (event.stayId) {
      router.push(`/stays/${event.stayId}`);
      return;
    }
    if (event.purchaseId) {
      router.push(`/purchases/${event.purchaseId}`);
      return;
    }
    if (event.leaseId) {
      router.push(`/leases/${event.leaseId}`);
    }
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>{error ?? 'Bien introuvable'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Retour</Text>
        </Pressable>
      </View>
    );
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
        showsVerticalScrollIndicator={false}
      >
        <CircleIconButton onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </CircleIconButton>

        {property.coverImage ? (
          <Image
            source={{ uri: property.coverImage }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : null}

        <Text style={styles.title}>{property.title}</Text>
        <Text style={styles.location}>{property.location ?? 'Congo'}</Text>

        <Text style={styles.sectionTitle}>Historique du bien</Text>
        <PropertyTimeline events={events} onEventPress={onEventPress} />

        <Pressable
          style={styles.secondary}
          onPress={() => router.push(`/property/${property.id}`)}
        >
          <Text style={styles.secondaryText}>Voir l’annonce</Text>
        </Pressable>
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
    gap: 12,
    padding: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  cover: {
    width: '100%',
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.primaryMuted,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  location: {
    marginTop: -8,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  secondary: {
    minHeight: 48,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  missing: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
