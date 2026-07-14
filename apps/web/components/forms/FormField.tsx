import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

export type FormFieldProps = {
  name: string;
  label: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({
  name,
  label,
  error,
  required = false,
  hint,
  className = '',
  children,
}: FormFieldProps): React.JSX.Element {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="mb-1.5 flex items-center gap-1 text-sm font-medium text-foreground"
      >
        <span>{label}</span>
        {required ? <span className="text-danger">*</span> : null}
        {hint ? (
          <span title={hint} aria-describedby={hintId} className="text-muted">
            <Icon icon="mdi:information-outline" className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs text-danger"
        >
          <Icon icon="mdi:alert-circle" className="h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

const FIELD_INPUT_CLASS =
  'block w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-2 focus:ring-accent/30 focus:outline-none';

const FIELD_ERROR_CLASS =
  'block w-full rounded-lg border border-danger bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-danger focus:ring-2 focus:ring-danger/30 focus:outline-none';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid = false, className = '', ...rest }: InputProps) {
  return (
    <input
      className={`${invalid ? FIELD_ERROR_CLASS : FIELD_INPUT_CLASS} ${className}`}
      {...rest}
    />
  );
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function Textarea({ invalid = false, className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      className={`${invalid ? FIELD_ERROR_CLASS : FIELD_INPUT_CLASS} ${className}`}
      {...rest}
    />
  );
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ invalid = false, className = '', children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={`${invalid ? FIELD_ERROR_CLASS : FIELD_INPUT_CLASS} appearance-none pr-9 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
      >
        <Icon icon="mdi:chevron-down" className="h-4 w-4" />
      </span>
    </div>
  );
}
