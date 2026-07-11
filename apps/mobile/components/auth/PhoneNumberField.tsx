import {
  PhoneCountryCallingCode,
  type PhoneCountrySelection,
} from '@/components/auth/PhoneCountryCallingCode';
import { colors, radii, spacing } from '@/constants/theme';
import {
  formatNationalInput,
  getNationalPlaceholder,
  isValidNationalNumber,
  reformatForCountry,
  toE164,
} from '@/lib/phone';
import type { CountryCode } from 'libphonenumber-js';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export type PhoneNumberFieldProps = {
  country: PhoneCountrySelection;
  onCountryChange: (next: PhoneCountrySelection) => void;
  value: string;
  onChange: (next: string) => void;
  /** Show error border when user tried to submit an invalid number */
  showError?: boolean;
};

export function PhoneNumberField({
  country,
  onCountryChange,
  value,
  onChange,
  showError = false,
}: PhoneNumberFieldProps): React.JSX.Element {
  const countryCode = country.countryCode as CountryCode;
  const invalid = showError && !isValidNationalNumber(value, countryCode);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Numéro de téléphone</Text>
      <View style={[styles.inputRow, invalid && styles.inputRowError]}>
        <PhoneCountryCallingCode
          value={country}
          onChange={(next) => {
            onCountryChange(next);
            onChange(reformatForCountry(value, next.countryCode as CountryCode));
          }}
          style={styles.countryPicker}
          hasError={invalid}
        />

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) =>
            onChange(formatNationalInput(text, countryCode))
          }
          placeholder={getNationalPlaceholder(countryCode)}
          placeholderTextColor={colors.primarySoft}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          accessibilityLabel="Numéro de téléphone"
        />
      </View>
      {invalid ? (
        <Text style={styles.errorText}>
          Numéro invalide pour ce pays
        </Text>
      ) : null}
    </View>
  );
}

export function getPhoneE164(
  value: string,
  country: PhoneCountrySelection,
): string | null {
  return toE164(value, country.countryCode as CountryCode);
}

export function isPhoneComplete(
  value: string,
  country: PhoneCountrySelection,
): boolean {
  return isValidNationalNumber(value, country.countryCode as CountryCode);
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRowError: {
    borderColor: colors.danger,
  },
  countryPicker: {
    borderLeftWidth: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.ink,
    paddingVertical: 14,
    paddingRight: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
});
