import {
  AsYouType,
  getCountryCallingCode,
  getExampleNumber,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import examples from 'libphonenumber-js/mobile/examples';

/** Francophone / bassin du Congo + diaspora courante. */
export const PHONE_COUNTRY_OPTIONS: {
  countryCode: CountryCode;
  callingCode: string;
  label: string;
}[] = [
  { countryCode: 'CG', callingCode: '242', label: 'Congo' },
  { countryCode: 'CD', callingCode: '243', label: 'RDC' },
  { countryCode: 'GA', callingCode: '241', label: 'Gabon' },
  { countryCode: 'CM', callingCode: '237', label: 'Cameroun' },
  { countryCode: 'CF', callingCode: '236', label: 'RCA' },
  { countryCode: 'TD', callingCode: '235', label: 'Tchad' },
  { countryCode: 'FR', callingCode: '33', label: 'France' },
  { countryCode: 'BE', callingCode: '32', label: 'Belgique' },
  { countryCode: 'CA', callingCode: '1', label: 'Canada' },
];

export type PhoneCountrySelection = {
  countryCode: CountryCode;
  callingCode: string;
};

export const DEFAULT_PHONE_COUNTRY: PhoneCountrySelection = {
  countryCode: 'CG',
  callingCode: '242',
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatNationalInput(
  raw: string,
  countryCode: CountryCode,
): string {
  const formatter = new AsYouType(countryCode);
  const formatted = formatter.input(raw);
  const parsed = formatter.getNumber();
  if (parsed?.countryCallingCode) {
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

export function toE164(
  value: string,
  countryCode: CountryCode,
): string | null {
  const parsed = parsePhoneNumberFromString(value, countryCode);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

export function reformatForCountry(
  value: string,
  countryCode: CountryCode,
): string {
  const national = digitsOnly(value);
  if (!national) return '';
  return formatNationalInput(national, countryCode);
}

export function callingCodeFor(countryCode: CountryCode): string {
  return getCountryCallingCode(countryCode);
}

export type ParsedE164Phone = {
  countryCode: CountryCode;
  callingCode: string;
  national: string;
};

/** Split an E.164 number into country + national display parts. */
export function parseE164Phone(
  e164: string | null | undefined,
): ParsedE164Phone | null {
  if (!e164?.trim()) return null;
  const parsed = parsePhoneNumberFromString(e164.trim());
  if (!parsed?.country) return null;
  return {
    countryCode: parsed.country,
    callingCode: parsed.countryCallingCode,
    national: parsed.formatNational(),
  };
}
