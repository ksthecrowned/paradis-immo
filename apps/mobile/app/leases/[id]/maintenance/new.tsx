import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import {
  addMaintenanceTicket,
  canCreateMaintenance,
  getMockLease,
  type MaintenanceUrgency,
} from '@/lib/mock-leases';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const URGENCY: Array<{ key: MaintenanceUrgency; label: string }> = [
  { key: 'LOW', label: 'Basse' },
  { key: 'NORMAL', label: 'Normale' },
  { key: 'HIGH', label: 'Haute' },
];

export default function NewMaintenanceScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leaseId = String(id ?? '');
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<MaintenanceUrgency>('NORMAL');
  const [submitting, setSubmitting] = useState(false);

  const lease = useMemo(() => getMockLease(leaseId), [leaseId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/leases/${leaseId}/maintenance/new`,
        );
        if (!active) return;
        setReady(ok);
        if (ok) {
          const current = getMockLease(leaseId);
          if (!current || !canCreateMaintenance(current)) {
            showFeedback({
              type: 'warning',
              title: 'Indisponible',
              message: 'Signalement impossible pour ce bail.',
            });
            router.back();
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [leaseId, showFeedback]),
  );

  const canSubmit = title.trim().length >= 3 && !submitting;

  const handleSubmit = (): void => {
    if (!canSubmit || !lease) return;
    setSubmitting(true);
    addMaintenanceTicket({
      leaseId: lease.id,
      title: title.trim(),
      description: description.trim(),
      urgency,
    });
    showFeedback({
      type: 'success',
      title: 'Ticket créé',
      message: 'Votre signalement a bien été enregistré.',
    });
    setSubmitting(false);
    router.back();
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
        <Text style={styles.topTitle}>Signaler un problème</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Titre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex. Fuite d’eau"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez le problème…"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Urgence</Text>
        <View style={styles.chips}>
          {URGENCY.map((item) => {
            const active = urgency === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setUrgency(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>Envoyer</Text>
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
    gap: 10,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  submit: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.surface,
  },
});
