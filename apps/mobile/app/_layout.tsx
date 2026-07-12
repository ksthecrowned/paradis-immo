import 'react-native-gesture-handler';
import { colors, getBootColorScheme } from '@/constants/theme';
import { FeedbackProvider } from '@/context/FeedbackContext';
import { LocationProvider } from '@/context/LocationContext';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): React.JSX.Element {
  const statusBarStyle =
    getBootColorScheme() === 'light' ? 'dark' : 'light';

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocationProvider requestOnMount={false}>
          <FeedbackProvider>
            <NotificationBootstrap />
            <StatusBar style={statusBarStyle} />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'fade',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="welcome" />
              <Stack.Screen name="onboarding/index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen
                name="(auth)/register"
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="(auth)/otp-verify"
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="(auth)/setup"
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="(auth)/personnal-infos"
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="property/[id]/index"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="property/[id]/neighborhood"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen
                name="property/[id]/street-view"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen
                name="property/[id]/tour-360"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen
                name="property/[id]/gallery"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen
                name="property/[id]/visit"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="property/[id]/book"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="property/[id]/sale-inquiry"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="payment/[id]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="activity"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="portfolio/[propertyId]"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="stays/[id]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="purchases/[id]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="leases/index"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="leases/[id]/index"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="leases/[id]/maintenance/new"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="profile/edit"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="profile/settings"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="profile/documents"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="agency/[id]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="notifications"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="search"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="filters"
                options={{
                  headerShown: false,
                  animation: 'slide_from_bottom',
                  presentation: 'modal',
                }}
              />
              <Stack.Screen
                name="category/[key]"
                options={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              />
            </Stack>
          </FeedbackProvider>
        </LocationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
