import { colors, radii, spacing } from '@/constants/theme';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSheetProps = {
  children: ReactNode;
  onLayoutHeight?: (height: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** Floating bottom sheet — same pattern as ride-client LiveBottomSheet. */
export function BottomSheet({
  children,
  onLayoutHeight,
  style,
}: BottomSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const handleLayout = (event: LayoutChangeEvent): void => {
    onLayoutHeight?.(event.nativeEvent.layout.height);
  };

  return (
    <View
      style={[
        styles.sheet,
        { paddingBottom: Math.max(insets.bottom, 12) },
        style,
      ]}
      onLayout={handleLayout}
    >
      <View style={styles.hitArea}>
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  hitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: '#D1D5DB',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
});
