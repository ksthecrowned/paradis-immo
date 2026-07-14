'use client';

import { useState, type ChangeEvent } from 'react';
import { Icon } from '@iconify/react';

export type NumberInputProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
};

const BASE =
  'block w-full rounded-lg border bg-search px-3 py-2.5 text-center text-sm text-foreground placeholder:text-muted focus:ring-2 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const STATE = (invalid: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : 'border-input-border focus:border-input-focus-border focus:ring-accent/30';

const BTN =
  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-input-border bg-card text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/30';

const parse = (raw: string): number | null => {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const clamp = (n: number, min?: number, max?: number): number => {
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
};

/**
 * Number input with explicit [-] / [+] buttons and a centered text
 * field. The native spin buttons are hidden so the UI is consistent
 * across browsers. The value is exchanged with the parent as a
 * string (empty string = no value), matching the rest of the form
 * fields.
 */
export function NumberInput({
  name,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  invalid = false,
  disabled = false,
  required = false,
  className = '',
  ariaLabel,
}: NumberInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  const current = parse(value) ?? 0;
  const atMin = typeof min === 'number' && current <= min;
  const atMax = typeof max === 'number' && current >= max;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const commit = () => {
    const n = parse(value);
    if (n === null) {
      // Empty is allowed if not required.
      if (!required && value === '') return;
      return;
    }
    const clamped = clamp(n, min, max);
    if (clamped !== n) onChange(String(clamped));
  };

  const increment = () => {
    if (disabled) return;
    const n = parse(value) ?? 0;
    const next = n + step;
    const clamped = clamp(next, min, max);
    onChange(String(clamped));
  };

  const decrement = () => {
    if (disabled) return;
    const n = parse(value) ?? 0;
    const next = n - step;
    const clamped = clamp(next, min, max);
    onChange(String(clamped));
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || atMin}
        aria-label={ariaLabel ? `Diminuer ${ariaLabel}` : 'Diminuer'}
        className={BTN}
      >
        <Icon icon="mdi:minus" className="h-4 w-4" />
      </button>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={`${BASE} ${STATE(invalid)} ${focused ? '' : ''}`}
      />
      <button
        type="button"
        onClick={increment}
        disabled={disabled || atMax}
        aria-label={ariaLabel ? `Augmenter ${ariaLabel}` : 'Augmenter'}
        className={BTN}
      >
        <Icon icon="mdi:plus" className="h-4 w-4" />
      </button>
    </div>
  );
}
