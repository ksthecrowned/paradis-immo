import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function StarRating({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}): React.JSX.Element {
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= filled ? 'star' : 'star-outline'}
          size={size}
          color={n <= filled ? '#F5B301' : colors.muted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
