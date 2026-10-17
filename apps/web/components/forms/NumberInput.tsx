'use client';

import { type ChangeEvent, type KeyboardEvent } from 'react';
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
  allowDecimals?: boolean;
  className?: string;
  ariaLabel?: string;
};

const BASE =
  'min-w-0 w-full border-0 bg-transparent p-0 text-base text-active placeholder:text-placeholder focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const STATE = (invalid: boolean) =>
  invalid
    ? 'border-danger focus-within:border-danger focus-within:ring-danger/30'
    : 'border-input-border focus-within:border-input-focus-border focus-within:ring-accent/30';

const BTN =
  'inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-input-border bg-card text-muted shadow-sm transition-colors hover:bg-accent/10 hover:text-accent disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/30';

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
 * Sanitize a typed string to a numeric form:
 * - keep digits, an optional single leading minus, an optional single
 *   decimal point (when `allowDecimals` is true)
 * - reject any other character
 *
 * Returns null if the result is not a valid number.
 */
const sanitize = (raw: string, allowDecimals: boolean): string | null => {
  if (raw === '') return '';
  // Build a regex matching the format we accept.
  const re = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
  if (!re.test(raw)) return null;
  // Reject "-" alone, "." alone, "-." etc. — user is mid-typing.
  if (raw === '-' || raw === '.' || raw === '-.') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return raw;
};

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
  allowDecimals = true,
  className = '',
  ariaLabel,
}: NumberInputProps): React.JSX.Element {
  const current = parse(value) ?? 0;
  const atMin = typeof min === 'number' && current <= min;
  const atMax = typeof max === 'number' && current >= max;

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = sanitize(e.target.value, allowDecimals);
    if (next === null) return; // Reject invalid input — keep previous value.
    onChange(next);
  };

  // Block keys that would produce an invalid character.
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    const allowedControl = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ];
    if (allowedControl.includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return;
    }
    if (/^\d$/.test(e.key)) return;
    if (e.key === '-' && (e.currentTarget.selectionStart ?? 0) === 0) return;
    if (allowDecimals && e.key === '.' && !e.currentTarget.value.includes('.')) {
      return;
    }
    e.preventDefault();
  };

  const commit = (): void => {
    const n = parse(value);
    if (n === null) {
      // Empty is allowed if not required.
      if (!required && value === '') return;
      return;
    }
    const clamped = clamp(n, min, max);
    if (clamped !== n) onChange(String(clamped));
  };

  const increment = (): void => {
    if (disabled) return;
    const n = parse(value) ?? 0;
    const next = n + step;
    const clamped = clamp(next, min, max);
    onChange(String(clamped));
  };

  const decrement = (): void => {
    if (disabled) return;
    const n = parse(value) ?? 0;
    const next = n - step;
    const clamped = clamp(next, min, max);
    onChange(String(clamped));
  };

  return (
    <div
      className={[
        'flex items-center gap-3 rounded-lg border bg-search px-3 py-2.5 transition-colors focus-within:ring-2',
        STATE(invalid),
        className,
      ].join(' ')}
    >
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={BASE}
      />
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || atMin}
          aria-label={ariaLabel ? `Diminuer ${ariaLabel}` : 'Diminuer'}
          className={BTN}
        >
          <Icon icon="mdi:minus" className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={increment}
          disabled={disabled || atMax}
          aria-label={ariaLabel ? `Augmenter ${ariaLabel}` : 'Augmenter'}
          className={BTN}
        >
          <Icon icon="mdi:plus" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
