import { colors, spacing } from '@/constants/theme';
import { isAuthenticated } from '@/lib/auth';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Boot gate only. Welcome lives at `/welcome` because `(tabs)/index` also
 * resolves to `/`, so `router.replace('/')` from tabs is a no-op.
 */
export default function IndexScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setReady(false);
      void isAuthenticated().then((ok) => {
        if (!active) return;
        setAuthed(ok);
        setReady(true);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!ready) {
    return (
      <View style={[styles.boot, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/logo-paradis-immo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (authed) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  logo: {
    width: 250,
    height: 250,
    resizeMode: 'contain',
  },
});
