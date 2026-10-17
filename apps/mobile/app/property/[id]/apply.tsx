import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { createRentalApplication } from '@/lib/applications';
import { isValidMoveInDate } from '@/lib/applications-utils';
import { ApiError } from '@/lib/api';
import { fetchCatalogProperty } from '@/lib/catalog';
import { getErrorMessage } from '@/lib/feedback';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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

export default function ApplyForRentalScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [occupants, setOccupants] = useState('1');
  const [occupation, setOccupation] = useState('');
  const [income, setIncome] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const row = await fetchCatalogProperty(propertyId);
    if (row.mode !== 'RENT_LONG') {
      throw new Error('Les candidatures sont réservées aux locations longues.');
    }
    setProperty(row);
  }, [propertyId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(router, `/property/${propertyId}/apply`);
        if (!active) return;
        if (ok) {
          try {
            await load();
          } catch (err) {
            showFeedback({
              type: 'error',
              title: 'Candidature',
              message: getErrorMessage(err, 'Impossible de charger le bien.'),
            });
            router.back();
          }
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load, propertyId, showFeedback]),
  );

  const occupantCount = Number(occupants);
  const incomeAmount = income.trim() ? Number(income) : undefined;
  const canSubmit =
    !!property &&
    !submitting &&
    isValidMoveInDate(date) &&
    Number.isInteger(occupantCount) &&
    occupantCount >= 1 &&
    occupantCount <= 20 &&
    (incomeAmount === undefined ||
      (Number.isFinite(incomeAmount) && incomeAmount >= 0));

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createRentalApplication(propertyId, {
        desiredMoveIn: new Date(`${date}T00:00:00.000Z`).toISOString(),
        occupants: occupantCount,
        ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
        ...(incomeAmount !== undefined ? { declaredIncome: incomeAmount } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      showFeedback({
        type: 'success',
        title: 'Candidature envoyée',
        message: 'Vous pourrez suivre son statut dans Mes candidatures.',
        buttons: [
          {
            text: 'Voir mes candidatures',
            onPress: () => router.replace('/applications'),
          },
        ],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showFeedback({
          type: 'warning',
          title: 'Candidature déjà ouverte',
          message:
            'Une candidature existe déjà pour ce bien. Vous pouvez la retrouver dans Mes candidatures.',
          buttons: [
            { text: 'Fermer', style: 'cancel' },
            {
              text: 'Mes candidatures',
              onPress: () => router.replace('/applications'),
            },
          ],
        });
      } else {
        showFeedback({
          type: 'error',
          title: 'Envoi impossible',
          message: getErrorMessage(err, 'Votre candidature n’a pas été envoyée.'),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.title}>Candidature locative</Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.property}>
          <Text style={styles.propertyTitle}>{property?.title}</Text>
          <Text style={styles.muted}>{property?.location}</Text>
        </View>
        <Field
          label="Date d’emménagement souhaitée (AAAA-MM-JJ)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-12-01"
          keyboardType="numbers-and-punctuation"
        />
        {date && !isValidMoveInDate(date) ? (
          <Text style={styles.fieldError}>Saisissez une date valide, aujourd’hui ou ultérieure.</Text>
        ) : null}
        <Field
          label="Nombre d’occupants"
          value={occupants}
          onChangeText={setOccupants}
          keyboardType="number-pad"
        />
        <Field
          label="Profession"
          value={occupation}
          onChangeText={setOccupation}
          placeholder="Facultatif"
        />
        <Field
          label="Revenu mensuel déclaré (FCFA)"
          value={income}
          onChangeText={setIncome}
          placeholder="Facultatif"
          keyboardType="numeric"
        />
        <Text style={styles.label}>Message au gestionnaire</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Présentez brièvement votre projet de location…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
        <Pressable
          style={styles.docsLink}
          onPress={() => router.push('/profile/documents')}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={styles.docsText}>Consulter mon dossier de justificatifs</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          style={[styles.submit, !canSubmit && styles.disabled]}
          onPress={() => void submit()}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>
            {submitting ? 'Envoi…' : 'Envoyer ma candidature'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.ink },
  content: { paddingHorizontal: spacing.md, gap: 12 },
  property: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    gap: 4,
  },
  propertyTitle: { fontSize: 17, fontWeight: '800', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 110, paddingTop: 12 },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  docsLink: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  docsText: { flex: 1, color: colors.primary, fontWeight: '700' },
  submit: {
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' },
});
