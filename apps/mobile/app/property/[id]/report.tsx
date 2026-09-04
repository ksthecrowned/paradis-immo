import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/feedback';
import {
    REPORT_REASON_LABELS,
    submitPropertyReport,
    type PropertyReportReason,
} from '@/lib/property-reports';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS = Object.keys(REPORT_REASON_LABELS) as PropertyReportReason[];

export default function PropertyReportScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');

  const [reason, setReason] = useState<PropertyReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    reason != null &&
    (reason !== 'OTHER' || description.trim().length >= 3) &&
    !submitting;

  const handleSubmit = async (): Promise<void> => {
    if (!reason || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPropertyReport(
        propertyId,
        reason,
        description.trim() || undefined,
      );
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible d’envoyer le signalement'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.doneBox}>
          <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
          <Text style={styles.doneTitle}>Signalement envoyé</Text>
          <Text style={styles.doneBody}>
            Merci. Notre équipe examinera cette annonce.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Signaler l’annonce</Text>
        <View style={{ width: 54 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>Choisissez un motif</Text>
        {REASONS.map((r) => {
          const selected = reason === r;
          return (
            <Pressable
              key={r}
              style={[styles.reasonRow, selected && styles.reasonRowSelected]}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.reasonLabel,
                  selected && styles.reasonLabelSelected,
                ]}
              >
                {REPORT_REASON_LABELS[r]}
              </Text>
              {selected ? (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                />
              ) : (
                <View style={styles.radio} />
              )}
            </Pressable>
          );
        })}

        <Text style={styles.hint}>
          Précisions{reason === 'OTHER' ? ' (obligatoire)' : ' (optionnel)'}
        </Text>
        <TextInput
          style={styles.input}
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Décrivez le problème…"
          placeholderTextColor="#4B5563"
          maxLength={1000}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryBtnText}>Envoyer</Text>
          )}
        </Pressable>
      </ScrollView>
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
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  reasonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    fontWeight: '500',
  },
  reasonLabelSelected: {
    fontWeight: '700',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  input: {
    minHeight: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  doneBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  doneTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  doneBody: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
