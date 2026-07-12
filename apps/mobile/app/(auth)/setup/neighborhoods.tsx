import { SetupShell } from '@/components/setup/SetupShell';
import { useSeekerSetup } from '@/context/SeekerSetupContext';
import { useFeedback } from '@/context/FeedbackContext';
import { colors, radii, spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/feedback';
import {
  listCities,
  listQuartiersForCity,
  type PublicQuartier,
} from '@/lib/locations';
import { POPULAR_QUARTIER_NAMES } from '@/lib/seeker-setup';
import { persistSeekerSetupAndSync } from '@/lib/seeker-setup-persist';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SetupNeighborhoodsScreen(): React.JSX.Element {
  const { draft, setQuartiers } = useSeekerSetup();
  const { showFeedback } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [quartiers, setLocalQuartiers] = useState<PublicQuartier[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const cities = await listCities('CG');
        const bzv =
          cities.find((c) => c.name.toLowerCase() === 'brazzaville') ??
          cities[0];
        if (!bzv) {
          throw new Error('Aucune ville disponible');
        }
        const rows = await listQuartiersForCity(bzv.id);
        if (active) setLocalQuartiers(rows);
      } catch (err) {
        if (active) {
          setError(
            getErrorMessage(err, 'Impossible de charger les quartiers'),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const popular = useMemo(() => {
    const preferred = new Set(
      POPULAR_QUARTIER_NAMES.map((n) => n.toLowerCase()),
    );
    return quartiers.filter((q) => preferred.has(q.name.toLowerCase()));
  }, [quartiers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quartiers;
    return quartiers.filter((row) => row.name.toLowerCase().includes(q));
  }, [quartiers, query]);

  const toggle = (id: string): void => {
    const selected = draft.preferredQuartierIds.includes(id);
    if (selected) {
      setQuartiers(draft.preferredQuartierIds.filter((x) => x !== id));
      return;
    }
    if (draft.preferredQuartierIds.length >= 3) return;
    setQuartiers([...draft.preferredQuartierIds, id]);
  };

  const finish = async (override?: Partial<typeof draft>): Promise<void> => {
    if (saving) return;
    setSaving(true);
    const payload = { ...draft, ...override };
    try {
      await persistSeekerSetupAndSync(payload);
      router.replace('/(auth)/personnal-infos');
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Préférences',
        message: getErrorMessage(
          err,
          'Impossible d’enregistrer vos préférences',
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (item: PublicQuartier): React.JSX.Element => {
    const selected = draft.preferredQuartierIds.includes(item.id);
    return (
      <Pressable
        key={item.id}
        onPress={() => toggle(item.id)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={styles.rowLabel}>{item.name}</Text>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? (
            <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SetupShell
      stepIndex={3}
      title="Quels quartiers vous intéressent ?"
      subtitle="Vous pouvez en choisir jusqu’à 3"
      canContinue={!saving}
      continuing={saving}
      onSkip={() => {
        setQuartiers([]);
        void finish({ preferredQuartierIds: [] });
      }}
      onContinue={() => void finish()}
    >
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un quartier…"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          {popular.length > 0 && !query.trim() ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Populaires</Text>
              <View style={styles.card}>{popular.map(renderRow)}</View>
            </View>
          ) : null}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {query.trim() ? 'Résultats' : 'Tous les quartiers'}
            </Text>
            <View style={styles.card}>
              {filtered.length === 0 ? (
                <Text style={styles.empty}>Aucun quartier trouvé</Text>
              ) : (
                filtered.map(renderRow)
              )}
            </View>
          </View>
        </>
      )}
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    paddingVertical: 12,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
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
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  empty: {
    padding: 14,
    fontSize: 14,
    color: colors.muted,
  },
  error: {
    fontSize: 14,
    color: colors.danger,
  },
});
