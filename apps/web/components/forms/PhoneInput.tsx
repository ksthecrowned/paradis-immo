'use client';

import {
  DEFAULT_PHONE_COUNTRY,
  PHONE_COUNTRY_OPTIONS,
  formatNationalInput,
  getNationalPlaceholder,
  isValidNationalNumber,
  reformatForCountry,
  toE164,
  type PhoneCountrySelection,
} from '@/lib/phone';
import type { CountryCode } from 'libphonenumber-js';
import { useId } from 'react';

export type PhoneInputProps = {
  country?: PhoneCountrySelection;
  onCountryChange?: (next: PhoneCountrySelection) => void;
  value: string;
  onChange: (national: string) => void;
  label?: string;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  name?: string;
  id?: string;
};

export function PhoneInput({
  country = DEFAULT_PHONE_COUNTRY,
  onCountryChange,
  value,
  onChange,
  label = 'Numéro de téléphone',
  required = false,
  invalid = false,
  disabled = false,
  hint,
  error,
  name = 'phone',
  id,
}: PhoneInputProps): React.JSX.Element {
  const autoId = useId();
  const fieldId = id ?? name;
  const countryCode = country.countryCode as CountryCode;
  const showError =
    invalid ||
    Boolean(error) ||
    (value.trim() !== '' && !isValidNationalNumber(value, countryCode));

  return (
    <div>
      {label ? (
        <label
          htmlFor={fieldId}
          className="mb-1.5 flex items-center gap-1 text-sm text-foreground"
        >
          <span>{label}</span>
          {required ? <span className="text-danger">*</span> : null}
        </label>
      ) : null}
      <div
        className={
          'flex overflow-hidden rounded-lg border bg-search ' +
          (showError
            ? 'border-danger ring-2 ring-danger/20'
            : 'border-input-border focus-within:border-input-focus-border focus-within:ring-2 focus-within:ring-accent/30')
        }
      >
        <select
          aria-label="Indicatif pays"
          disabled={disabled}
          value={country.countryCode}
          onChange={(e) => {
            const nextCode = e.target.value as CountryCode;
            const opt = PHONE_COUNTRY_OPTIONS.find(
              (o) => o.countryCode === nextCode,
            );
            const next: PhoneCountrySelection = {
              countryCode: nextCode,
              callingCode: opt?.callingCode ?? country.callingCode,
            };
            onCountryChange?.(next);
            onChange(reformatForCountry(value, nextCode));
          }}
          className="shrink-0 border-0 border-e border-input-border bg-transparent py-2.5 ps-3 pe-2 text-sm font-medium text-foreground focus:ring-0 disabled:opacity-60"
        >
          {PHONE_COUNTRY_OPTIONS.map((o) => (
            <option key={o.countryCode} value={o.countryCode}>
              {o.countryCode} +{o.callingCode}
            </option>
          ))}
        </select>
        <input
          id={fieldId}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={value}
          placeholder={getNationalPlaceholder(countryCode)}
          onChange={(e) =>
            onChange(formatNationalInput(e.target.value, countryCode))
          }
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus:ring-0 disabled:opacity-60"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function getPhoneE164(
  value: string,
  country: PhoneCountrySelection,
): string | null {
  return toE164(value, country.countryCode);
}

export function isPhoneComplete(
  value: string,
  country: PhoneCountrySelection,
): boolean {
  return isValidNationalNumber(value, country.countryCode);
}
