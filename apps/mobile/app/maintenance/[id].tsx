import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import { formatDateFr } from '@/lib/format-date-fr';
import {
  addMaintenanceComment,
  getMaintenanceTicket,
  maintenanceStatusLabel,
  transitionMaintenanceTicket,
  type PublicMaintenanceTicketDetail,
} from '@/lib/maintenance';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CAN_CANCEL = new Set(['OPEN', 'TRIAGED', 'AWAITING_QUOTE', 'ASSIGNED', 'SCHEDULED']);

export default function MaintenanceDetailScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<PublicMaintenanceTicketDetail | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await getMaintenanceTicket(ticketId);
      setTicket(detail);
      setProperty(await fetchCatalogProperty(detail.propertyId));
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de charger cette demande.'));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/maintenance/${ticketId}`);
        if (!active) return;
        setReady(ok);
        if (ok) {
          setLoading(true);
          await load();
        }
      })();
      return () => {
        active = false;
      };
    }, [load, ticketId]),
  );

  const performTransition = async (
    to: string,
    details: { note?: string; cancelReason?: string } = {},
  ): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await transitionMaintenanceTicket(ticketId, { to, ...details });
      await load();
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Action impossible',
        message: getErrorMessage(err, 'Le statut n’a pas été modifié.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const submitComment = async (): Promise<void> => {
    const body = comment.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await addMaintenanceComment(ticketId, body);
      setComment('');
      await load();
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Message non envoyé',
        message: getErrorMessage(err, 'Impossible d’ajouter votre message.'),
      });
    } finally {
      setBusy(false);
    }
  };

  const askTransition = (to: string, label: string): void => {
    showFeedback({
      type: 'warning',
      title: label,
      message: 'Confirmez-vous cette action sur votre demande ?',
      buttons: [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Confirmer',
          style: to === 'CANCELLED' ? 'destructive' : 'default',
          onPress: () => {
            void performTransition(
              to,
              to === 'CANCELLED'
                ? { cancelReason: 'Annulation demandée par le déclarant' }
                : { note: label },
            );
          },
        },
      ],
    });
  };

  if (!ready || loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error || !ticket) {
    return (
      <View style={[styles.screen, styles.centered, styles.errorScreen]}>
        <Text style={styles.errorText}>{error ?? 'Demande introuvable'}</Text>
        <Pressable onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.link}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Suivi maintenance</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <StatusBadge
            label={maintenanceStatusLabel(ticket.status)}
            tone={
              ticket.status === 'CLOSED' || ticket.status === 'RESOLVED'
                ? 'success'
                : ticket.status === 'CANCELLED'
                  ? 'danger'
                  : 'warning'
            }
          />
          <Text style={styles.ticketTitle}>{ticket.title}</Text>
          <Text style={styles.body}>{property?.title ?? 'Bien'}</Text>
          <Text style={styles.muted}>{ticket.description}</Text>
          <Text style={styles.muted}>Priorité · {ticket.priority}</Text>
          <Text style={styles.muted}>Créé le {formatDateFr(ticket.createdAt)}</Text>
          {ticket.scheduledAt ? (
            <Text style={styles.muted}>Intervention · {formatDateFr(ticket.scheduledAt)}</Text>
          ) : null}
          {ticket.availability ? (
            <Text style={styles.muted}>Disponibilités · {ticket.availability}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {ticket.history.map((entry, index) => (
            <View key={`${entry.createdAt}-${index}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineBody}>
                <Text style={styles.body}>
                  {entry.from === entry.to
                    ? maintenanceStatusLabel(entry.to)
                    : `${maintenanceStatusLabel(entry.from)} → ${maintenanceStatusLabel(entry.to)}`}
                </Text>
                <Text style={styles.muted}>{formatDateFr(entry.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>

        {ticket.status === 'RESOLVED' ? (
          <View style={styles.actions}>
            <Pressable
              style={styles.primaryAction}
              disabled={busy}
              onPress={() => askTransition('CLOSED', 'Confirmer la résolution')}
            >
              <Text style={styles.primaryText}>Confirmer la résolution</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryAction}
              disabled={busy}
              onPress={() => askTransition('OPEN', 'Rouvrir la demande')}
            >
              <Text style={styles.secondaryText}>Signaler que le problème persiste</Text>
            </Pressable>
          </View>
        ) : CAN_CANCEL.has(ticket.status) ? (
          <Pressable
            style={styles.cancelAction}
            disabled={busy}
            onPress={() => askTransition('CANCELLED', 'Annuler la demande')}
          >
            <Text style={styles.cancelText}>Annuler la demande</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Échanges</Text>
          {ticket.comments.length === 0 ? (
            <Text style={styles.muted}>Aucun message pour le moment.</Text>
          ) : (
            ticket.comments.map((item) => (
              <View key={item.id} style={styles.comment}>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.muted}>{formatDateFr(item.createdAt)}</Text>
              </View>
            ))
          )}
          {ticket.status !== 'CANCELLED' && ticket.status !== 'CLOSED' ? (
            <>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Écrire un message à l’équipe de gestion…"
                placeholderTextColor={colors.muted}
                style={styles.input}
                multiline
                maxLength={2000}
              />
              <Pressable
                style={[styles.primaryAction, (!comment.trim() || busy) && styles.disabled]}
                disabled={!comment.trim() || busy}
                onPress={() => void submitComment()}
                accessibilityRole="button"
              >
                <Text style={styles.primaryText}>{busy ? 'Envoi…' : 'Envoyer'}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorScreen: { padding: spacing.lg, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '800' },
  content: { paddingHorizontal: spacing.md, gap: spacing.md },
  card: { gap: 10, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  ticketTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: colors.primary },
  timelineBody: { flex: 1, gap: 2 },
  actions: { gap: 8 },
  primaryAction: { minHeight: 46, borderRadius: radii.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: colors.onPrimary, fontWeight: '800', textAlign: 'center' },
  secondaryAction: { minHeight: 46, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryText: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
  cancelAction: { minHeight: 46, borderRadius: radii.full, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.danger, fontWeight: '700' },
  comment: { gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 },
  input: { minHeight: 72, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.bg, color: colors.ink, padding: 12, textAlignVertical: 'top' },
  disabled: { opacity: 0.5 },
  errorText: { color: colors.danger, textAlign: 'center' },
  link: { color: colors.primary, fontWeight: '700' },
});
