import 'react-native-get-random-values';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';

// This is the default configuration
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: true, // Reanimated runs in strict mode by default
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="signup" options={{ presentation: 'modal' }} />
        <Stack.Screen 
          name="modals/search-filters" 
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="search" 
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: true,
          }}
        />
        <Stack.Screen 
          name="modals/alert-immo" 
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: false,
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
