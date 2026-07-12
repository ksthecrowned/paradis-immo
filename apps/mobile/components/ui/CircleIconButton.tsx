import { colors, radii } from '@/constants/theme';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type CircleIconButtonProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Circular icon button — same style as auth back buttons. */
export function CircleIconButton({
  style,
  children,
  accessibilityRole = 'button',
  ...rest
}: CircleIconButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      style={[styles.btn, style]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 4,
  },
});
