import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { colors, radii, spacing } from '@/constants/theme';
import { useFeedback } from '@/context/FeedbackContext';
import { requestOtp, verifyOtp } from '@/lib/auth';
import { getErrorMessage } from '@/lib/feedback';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OTPVerifyScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { showFeedback } = useFeedback();
  const params = useLocalSearchParams<{ phone?: string; flow?: string }>();
  const phone = String(params.phone ?? '');
  const flow = params.flow === 'login' ? 'login' : 'register';
  const purpose = flow === 'login' ? 'LOGIN' : 'REGISTER';

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const handleChange = (value: string): void => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) {
      void submit(digits);
    }
  };

  const submit = async (otp: string): Promise<void> => {
    if (!phone || loading) return;
    setLoading(true);
    try {
      const tokens = await verifyOtp(phone, otp, purpose);
      const needsProfile = !tokens.user.name?.trim();
      if (flow === 'register') {
        router.replace('/(auth)/setup');
      } else if (needsProfile) {
        router.replace('/(auth)/personnal-infos');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Code invalide',
        message: getErrorMessage(err, 'Vérifiez le code reçu par SMS'),
      });
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (resendIn > 0 || !phone || sending) return;
    setSending(true);
    try {
      await requestOtp(phone, purpose);
      setResendIn(RESEND_SECONDS);
      setCode('');
      showFeedback({
        type: 'success',
        title: 'Code renvoyé',
        message: 'Un nouveau SMS vient de vous être envoyé.',
      });
    } catch (err) {
      showFeedback({
        type: 'error',
        title: 'Paradis Immo',
        message: getErrorMessage(err, 'Impossible de renvoyer le code'),
      });
    } finally {
      setSending(false);
    }
  };

  const maskedPhone =
    phone.length > 6
      ? `${phone.slice(0, 4)} ··· ${phone.slice(-3)}`
      : phone;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <CircleIconButton
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>

        <View style={styles.header}>
          <Text style={styles.title}>Vérification 🔐</Text>
          <Text style={styles.subtitle}>
            Entrez le code à {OTP_LENGTH} chiffres envoyé au{' '}
            <Text style={styles.phoneHighlight}>{maskedPhone || '…'}</Text>
          </Text>
        </View>

        <Pressable
          style={styles.otpRow}
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel="Saisir le code OTP"
        >
          {Array.from({ length: OTP_LENGTH }).map((_, index) => {
            const digit = code[index] ?? '';
            const active = index === code.length;
            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                  active ? styles.otpBoxActive : null,
                ]}
              >
                <Text style={styles.otpDigit}>{digit}</Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          autoFocus
          caretHidden
          accessibilityLabel="Code de vérification"
        />

        <View style={styles.resendBlock}>
          {resendIn > 0 ? (
            <Text style={styles.resendMuted}>
              Renvoyer le code dans {resendIn}s
            </Text>
          ) : (
            <Pressable
              onPress={() => void handleResend()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel="Renvoyer le code"
            >
              <Text style={styles.resendLink}>
                {sending ? 'Envoi…' : 'Renvoyer le code'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              (code.length < OTP_LENGTH || loading) && styles.ctaDisabled,
              pressed &&
                code.length === OTP_LENGTH &&
                !loading &&
                styles.ctaPressed,
            ]}
            disabled={code.length < OTP_LENGTH || loading}
            onPress={() => void submit(code)}
            accessibilityRole="button"
            accessibilityLabel="Vérifier"
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.ctaText}>Vérifier</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: colors.ink,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  otpBox: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryMuted,
  },
  otpBoxActive: {
    borderColor: colors.primary,
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  resendBlock: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  resendMuted: {
    fontSize: 14,
    color: colors.muted,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  cta: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
