import {
  AsYouType,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';

/** Digits only (national number, no country calling code). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats national input as-you-type for the selected country.
 * Strips a leading country calling code if the user pasted an international number.
 */
export function formatNationalInput(
  raw: string,
  countryCode: CountryCode,
): string {
  const formatter = new AsYouType(countryCode);
  const formatted = formatter.input(raw);

  // If paste included +CC, keep only the national part in the field.
  const parsed = formatter.getNumber();
  if (parsed && parsed.countryCallingCode) {
    return parsed.formatNational();
  }

  return formatted;
}

export function getNationalPlaceholder(countryCode: CountryCode): string {
  const example = getExampleNumber(countryCode, examples);
  return example?.formatNational() ?? 'Numéro de téléphone';
}

export function isValidNationalNumber(
  value: string,
  countryCode: CountryCode,
): boolean {
  if (!digitsOnly(value)) return false;
  return isValidPhoneNumber(value, countryCode);
}

/** Returns E.164 (`+242…`) or null if invalid. */
export function toE164(
  value: string,
  countryCode: CountryCode,
): string | null {
  const parsed = parsePhoneNumberFromString(value, countryCode);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

/** Re-apply national formatting when the country changes. */
export function reformatForCountry(
  value: string,
  countryCode: CountryCode,
): string {
  const national = digitsOnly(value);
  if (!national) return '';
  return formatNationalInput(national, countryCode);
}
