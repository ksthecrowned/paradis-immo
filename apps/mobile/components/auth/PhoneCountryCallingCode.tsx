import { colors, getBootColorScheme, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import CountryPicker, {
  Flag,
  type Country,
  type CountryCode,
} from 'react-native-country-picker-modal';

/** Francophone / Congo basin + common diaspora — shown first in the modal. */
const PREFERRED_COUNTRIES: CountryCode[] = [
  'CG',
  'CD',
  'GA',
  'CM',
  'CF',
  'TD',
  'FR',
];

export type PhoneCountrySelection = {
  countryCode: CountryCode;
  callingCode: string;
};

export const DEFAULT_PHONE_COUNTRY: PhoneCountrySelection = {
  countryCode: 'CG',
  callingCode: '242',
};

type Props = {
  value: PhoneCountrySelection;
  onChange: (next: PhoneCountrySelection) => void;
  style?: StyleProp<ViewStyle>;
  showChevron?: boolean;
  /** Bordure d’erreur (alignée sur le champ téléphone associé) */
  hasError?: boolean;
  /** When false, country picker cannot be opened. */
  editable?: boolean;
};

function buildPickerTheme() {
  const isDark = getBootColorScheme() === 'dark';
  return {
    primaryColor: colors.primary,
    primaryColorVariant: isDark ? colors.primarySoft : colors.primaryMuted,
    backgroundColor: colors.bg,
    onBackgroundTextColor: colors.ink,
    filterPlaceholderTextColor: colors.muted,
    activeOpacity: 0.65,
    fontSize: 16,
    flagSize: 22,
    flagSizeButton: 20,
    itemHeight: 52,
  };
}

export function PhoneCountryCallingCode({
  value,
  onChange,
  style,
  showChevron = true,
  hasError,
  editable = true,
}: Props): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const pickerTheme = useMemo(() => buildPickerTheme(), []);

  const preferredCountries = useMemo(() => {
    const rest = PREFERRED_COUNTRIES.filter(
      (code) => code !== value.countryCode,
    );
    return [value.countryCode, ...rest];
  }, [value.countryCode]);

  const onSelect = (country: Country): void => {
    const code = country.callingCode[0] ?? '';
    onChange({ countryCode: country.cca2, callingCode: code });
    setVisible(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          if (editable) setVisible(true);
        }}
        disabled={!editable}
        style={({ pressed }) => [
          styles.box,
          hasError && styles.boxError,
          pressed && editable && styles.boxPressed,
          style,
        ]}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Indicatif +${value.callingCode}`}
        accessibilityHint={
          editable ? 'Ouvre la liste des pays' : undefined
        }
        accessibilityState={{ disabled: !editable }}
      >
        <View style={styles.triggerRow}>
          <Flag
            countryCode={value.countryCode}
            flagSize={20}
            withEmoji
            withFlagButton
          />
          <Text
            style={[styles.dial, !editable && styles.dialDisabled]}
            numberOfLines={1}
          >
            +{value.callingCode}
          </Text>
          {showChevron && editable ? (
            <Ionicons
              name="chevron-down"
              size={14}
              color={colors.muted}
              style={styles.chevron}
            />
          ) : null}
        </View>
      </Pressable>

      {editable ? (
        <CountryPicker
          theme={pickerTheme}
          countryCode={value.countryCode}
          preferredCountries={preferredCountries}
          visible={visible}
          filterProps={{
            placeholder: 'Rechercher un pays',
            placeholderTextColor: colors.muted,
            autoFocus: true,
            selectionColor: colors.primary,
            autoCorrect: false,
            clearButtonMode: 'while-editing',
          }}
          withFilter
          withCallingCode
          withEmoji
          withFlag
          withCloseButton
          translation="fra"
          onSelect={onSelect}
          onClose={() => setVisible(false)}
          renderFlagButton={() => null}
          modalProps={{
            animationType: 'slide',
            statusBarTranslucent: false,
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 44,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  boxPressed: {
    opacity: 0.7,
  },
  boxError: {
    borderColor: colors.danger,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    direction: 'ltr',
  },
  dial: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  dialDisabled: {
    color: colors.muted,
  },
  chevron: {
    marginLeft: -2,
  },
});
