import { colors } from '@/constants/theme';
import { Stack } from 'expo-router';

export default function PortfolioPropertyLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="rent"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}
