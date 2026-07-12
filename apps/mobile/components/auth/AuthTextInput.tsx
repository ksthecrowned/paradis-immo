import { colors, radii, spacing } from '@/constants/theme';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

export type AuthTextInputProps = TextInputProps & {
  label: string;
  hint?: string;
  hasError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * Text field matching auth screens (login / register / personal infos).
 */
export function AuthTextInput({
  label,
  hint,
  hasError = false,
  containerStyle,
  style,
  editable = true,
  placeholderTextColor = colors.muted,
  ...inputProps
}: AuthTextInputProps): React.JSX.Element {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          hasError && styles.inputError,
          style,
        ]}
        placeholderTextColor={placeholderTextColor}
        editable={editable}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  input: {
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputDisabled: {
    backgroundColor: colors.primaryMuted,
    color: colors.muted,
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
});
