import { colors, radii, spacing } from '@/constants/theme';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  loadError: string | null;
};

export function PropertyDetailMissing({
  loadError,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.missing, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.missingTitle}>
        {loadError ? 'Chargement impossible' : 'Bien introuvable'}
      </Text>
      {loadError ? (
        <Text style={styles.missingSubtitle}>{loadError}</Text>
      ) : null}
      <Pressable
        onPress={() => router.back()}
        style={styles.missingBtn}
        accessibilityRole="button"
      >
        <Text style={styles.missingBtnText}>Retour</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  missingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  missingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
