import { colors, radii, spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require('@/assets/images/welcome-bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          'rgba(16, 10, 85, 0.92)',
          'rgba(16, 10, 85, 0.45)',
          'transparent',
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={styles.overlay}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
      >
        <View style={styles.bottom}>
          <Text style={styles.headline}>
            Votre immobilier, au bout des doigts.
          </Text>
          <Text style={styles.subtitle}>
            Locations et ventes vérifiées — visitez, réservez et payez en toute
            confiance.
          </Text>

          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotLg]} />
            <View style={[styles.dot, styles.dotMd]} />
            <View style={[styles.dot, styles.dotSm]} />
            <View style={[styles.dot, styles.dotXs]} />
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="button"
              accessibilityLabel="Créer un compte"
            >
              <Text style={styles.ctaText}>Créer un compte</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, styles.ctaOutline]}
              onPress={() => router.push('/(auth)/login')}
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
            >
              <Text style={[styles.ctaText, { color: colors.primary }]}>
                Se connecter
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  headline: {
    textAlign: 'center',
    fontSize: 40,
    fontWeight: '900',
    color: colors.onPrimary,
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 340,
    alignSelf: 'center',
  },
  buttons: {
    gap: spacing.md,
  },
  cta: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ctaPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  dotLg: { width: 30, height: 10 },
  dotMd: { width: 10, height: 10 },
  dotSm: { width: 8, height: 8 },
  dotXs: { width: 4, height: 4 },
});
