import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getErrorMessage } from '@/lib/feedback';
import {
  listMySolvencyChecks,
  respondSolvencyCheck,
  type PublicSolvencyCheck,
} from '@/lib/solvency';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SolvencyChecksScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PublicSolvencyCheck[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMySolvencyChecks();
      setRows(list);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger les demandes'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, '/cahier-loyer/solvency');
        if (!active) return;
        setReady(ok);
        if (ok) await load();
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const handleRespond = async (
    id: string,
    accept: boolean,
  ): Promise<void> => {
    setBusyId(id);
    setError(null);
    try {
      await respondSolvencyCheck(id, accept);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de répondre'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Solvabilité</Text>
        <View style={{ width: 54 }} />
      </View>

      {!ready || loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.hint}>
            Un logeur peut demander à voir vos 3 derniers loyers payés. Vous
            validez ou refusez.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {rows.length === 0 ? (
            <Text style={styles.empty}>Aucune demande pour le moment.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.org}>{row.organizationName}</Text>
                <Text style={styles.status}>
                  {row.status === 'PENDING'
                    ? 'En attente de votre réponse'
                    : row.status === 'GRANTED'
                      ? 'Acceptée'
                      : row.status === 'DENIED'
                        ? 'Refusée'
                        : 'Expirée'}
                </Text>
                {row.status === 'PENDING' ? (
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.btn, styles.btnDeny]}
                      disabled={busyId === row.id}
                      onPress={() => void handleRespond(row.id, false)}
                    >
                      <Text style={styles.btnDenyText}>Refuser</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnAccept]}
                      disabled={busyId === row.id}
                      onPress={() => void handleRespond(row.id, true)}
                    >
                      {busyId === row.id ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.btnAcceptText}>Accepter</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  content: { paddingHorizontal: spacing.md, gap: 12 },
  hint: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: { color: colors.danger, fontWeight: '600' },
  empty: { color: colors.muted, marginTop: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    gap: 8,
  },
  org: { fontSize: 16, fontWeight: '700', color: colors.ink },
  status: { fontSize: 13, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDeny: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  btnDenyText: { fontWeight: '700', color: colors.ink },
  btnAccept: { backgroundColor: colors.primary },
  btnAcceptText: { fontWeight: '700', color: colors.onPrimary },
});
