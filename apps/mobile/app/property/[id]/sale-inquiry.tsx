import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { PropertySummaryCard } from '@/components/property/PropertySummaryCard';
import { SuccessScreen } from '@/components/ui/SuccessScreen';
import { colors, radii, spacing } from '@/constants/theme';
import { getStoredUser } from '@/lib/auth';
import { ensureAuthenticated } from '@/lib/auth-guard';
import { getPropertyById } from '@/lib/mock-properties';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

export default function SaleInquiryScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const property = useMemo(() => getPropertyById(propertyId), [propertyId]);

  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [tried, setTried] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const ok = await ensureAuthenticated(
          router,
          `/property/${propertyId}/sale-inquiry`,
        );
        if (!active) return;
        setReady(ok);
        if (ok) {
          const user = await getStoredUser();
          if (user?.phone) setPhone(user.phone);
        }
      })();
      return () => {
        active = false;
      };
    }, [propertyId]),
  );

  const canSubmit = message.trim().length >= 10;

  const handleSubmit = (): void => {
    setTried(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setDone(true);
    }, 400);
  };

  if (!property) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>Bien introuvable</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (done) {
    return (
      <SuccessScreen
        title="Demande envoyée"
        message="Un conseiller Paradis Immo vous recontactera bientôt au sujet de ce bien."
        primaryLabel="Voir mon activité"
        onPrimary={() => router.replace('/(tabs)/activity')}
        secondaryLabel="Retour au bien"
        onSecondary={() => router.replace(`/property/${property.id}`)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <CircleIconButton onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>
        <Text style={styles.topTitle}>Demande d’achat</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <PropertySummaryCard property={property} />

        <Text style={styles.label}>Votre message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Présentez votre projet, vos questions…"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textarea]}
          multiline
          textAlignVertical="top"
        />
        {tried && !canSubmit ? (
          <Text style={styles.error}>Minimum 10 caractères.</Text>
        ) : null}

        <Text style={styles.label}>Budget indicatif (optionnel)</Text>
        <TextInput
          value={budget}
          onChangeText={setBudget}
          placeholder="Ex. 60 000 000 FCFA"
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="default"
        />

        <Text style={styles.label}>Téléphone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+242 …"
          placeholderTextColor={colors.muted}
          style={styles.input}
          keyboardType="phone-pad"
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            submitting && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
          disabled={submitting}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Envoyer la demande"
        >
          {submitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.ctaText}>Envoyer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  missing: { fontSize: 17, fontWeight: '700', color: colors.ink },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  spacer: { width: 54 },
  content: { paddingHorizontal: spacing.md, gap: 10 },
  label: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  input: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 14,
  },
  error: { fontSize: 12, fontWeight: '600', color: colors.danger },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  cta: {
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryHover },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontSize: 16, fontWeight: '700', color: colors.surface },
});
