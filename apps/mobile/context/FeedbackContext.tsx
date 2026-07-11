import { colors, radii, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FeedbackButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type FeedbackOptions = {
  title: string;
  message: string;
  buttons?: FeedbackButton[];
  type?: 'info' | 'error' | 'success' | 'warning';
  /** Called when the modal closes without a button press (backdrop / back). */
  onDismiss?: () => void;
};

type FeedbackContextValue = {
  showFeedback: (options: FeedbackOptions) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const defaultButtons: FeedbackButton[] = [{ text: 'OK', style: 'default' }];

const typeConfig = {
  info: { icon: 'information-circle' as const, color: '#0284C7' },
  error: { icon: 'close-circle' as const, color: colors.danger },
  success: { icon: 'checkmark-circle' as const, color: colors.success },
  warning: { icon: 'warning' as const, color: colors.warning },
};

export function FeedbackProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<FeedbackOptions | null>(null);
  const closedByButtonRef = useRef(false);
  const optionsRef = useRef<FeedbackOptions | null>(null);
  const insets = useSafeAreaInsets();

  const showFeedback = useCallback((opts: FeedbackOptions) => {
    closedByButtonRef.current = false;
    const next = {
      ...opts,
      buttons: opts.buttons?.length ? opts.buttons : defaultButtons,
    };
    optionsRef.current = next;
    setOptions(next);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    const dismissed = !closedByButtonRef.current;
    const onDismiss = optionsRef.current?.onDismiss;
    setVisible(false);
    setOptions(null);
    optionsRef.current = null;
    if (dismissed) onDismiss?.();
  }, []);

  const handlePress = useCallback(
    (button: FeedbackButton) => {
      closedByButtonRef.current = true;
      hide();
      button.onPress?.();
    },
    [hide],
  );

  const config = options ? typeConfig[options.type ?? 'info'] : typeConfig.info;

  return (
    <FeedbackContext.Provider value={{ showFeedback }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={hide}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={hide}>
          <Pressable
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 16 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />
            {options ? (
              <>
                <View style={styles.header}>
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: `${config.color}20` },
                    ]}
                  >
                    <Ionicons
                      name={config.icon}
                      size={28}
                      color={config.color}
                    />
                  </View>
                  <Text style={styles.title}>{options.title}</Text>
                  <Text style={styles.message}>{options.message}</Text>
                </View>
                <View style={styles.buttons}>
                  {(options.buttons ?? defaultButtons).map((btn, i) => (
                    <TouchableOpacity
                      key={`${btn.text}-${i}`}
                      style={[
                        styles.btn,
                        btn.style === 'cancel' && styles.btnCancel,
                        btn.style === 'destructive' && styles.btnDestructive,
                      ]}
                      onPress={() => handlePress(btn)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          btn.style === 'cancel' && styles.btnTextCancel,
                          btn.style === 'destructive' &&
                            styles.btnTextDestructive,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    minHeight: 200,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttons: {
    gap: 12,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: colors.primaryMuted,
  },
  btnDestructive: {
    backgroundColor: colors.danger,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  btnTextCancel: {
    color: colors.ink,
  },
  btnTextDestructive: {
    color: colors.surface,
  },
});
