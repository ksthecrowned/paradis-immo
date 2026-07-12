import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  favorited: boolean;
  onShare: () => void;
  onToggleFavorite: () => void;
};

export function PropertyDetailTopBar({
  favorited,
  onShare,
  onToggleFavorite,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <CircleIconButton
        onPress={() => router.back()}
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={24} color={colors.ink} />
      </CircleIconButton>

      <View style={styles.topActions}>
        <CircleIconButton onPress={onShare} accessibilityLabel="Partager">
          <Ionicons
            name="share-social"
            size={23}
            color={colors.ink}
            style={{ marginRight: 2, marginTop: 2 }}
          />
        </CircleIconButton>
        <CircleIconButton
          onPress={onToggleFavorite}
          accessibilityLabel={
            favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'
          }
        >
          <Ionicons
            name={favorited ? 'heart' : 'heart-outline'}
            size={24}
            color={favorited ? colors.danger : colors.ink}
          />
        </CircleIconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
