import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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

const pickerTheme = {
  primaryColor: colors.primary,
  primaryColorVariant: colors.primaryHover,
  backgroundColor: colors.surface,
  onBackgroundTextColor: colors.ink,
  filterPlaceholderTextColor: colors.muted,
};

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
};

export function PhoneCountryCallingCode({
  value,
  onChange,
  style,
  showChevron = true,
  hasError,
}: Props): React.JSX.Element {
  const [visible, setVisible] = useState(false);

  const onSelect = (country: Country): void => {
    const code = country.callingCode[0] ?? '';
    onChange({ countryCode: country.cca2, callingCode: code });
    setVisible(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.box, hasError && styles.boxError, style]}
        accessibilityRole="button"
        accessibilityLabel="Choisir l'indicatif pays"
      >
        <View style={styles.triggerRow}>
          <View style={styles.flagSlot}>
            <Flag
              countryCode={value.countryCode}
              flagSize={20}
              withEmoji
              withFlagButton
            />
          </View>
          <Text style={styles.dial}>+{value.callingCode}</Text>
          {showChevron ? (
            <Ionicons name="chevron-down" size={14} color={colors.muted} />
          ) : null}
        </View>
      </Pressable>

      <CountryPicker
        theme={pickerTheme}
        countryCode={value.countryCode}
        preferredCountries={[value.countryCode]}
        visible={visible}
        filterProps={{ placeholder: 'Rechercher un pays' }}
        withFilter
        withAlphaFilter
        withCallingCode
        withEmoji
        withFlag
        translation="fra"
        onSelect={onSelect}
        onClose={() => setVisible(false)}
        renderFlagButton={() => null}
        modalProps={{
          statusBarTranslucent: false,
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingRight: 10,
    height: 20,
    borderRightWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    direction: 'ltr',
  },
  flagSlot: {
    marginRight: -10,
    marginTop: -4,
  },
  dial: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  boxError: {
    borderColor: colors.danger,
  },
});
