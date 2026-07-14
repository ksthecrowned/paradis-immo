# Owner Dashboard Forms & Details Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Owner dashboard forms and detail pages using a shared design system (FormCard, FormField, FormTabs, DetailCard, etc.), split read-only and edit screens, and align visual style with the mobile app. Migrate one entity at a time, **Propriétés first**.

**Architecture:** Build a shared design system under `apps/web/components/forms/`, `components/detail/`, `components/primitives/`, plus generic hooks (`useResourceForm`, `useResourceDetail`) and validation helpers (`lib/validation/`). Migrate each entity by:
1. Refactor the add page to use the new `<Entity>Form` (shared between add and edit)
2. Create a new dedicated `[id]/edit/page.tsx`
3. Refactor the detail page to read-only with new `Detail*` components
4. Refactor the list page
5. Remove the legacy inline-edit code

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind 4, Preline 4, `@iconify/react` (icons — already used everywhere, do NOT add lucide-react), bun.

## Global Constraints

- Use **Preline 4** classes (already integrated via `preline-boot.tsx`)
- Use **Tailwind 4** with the existing CSS variables in `apps/web/app/globals.css` (`bg-accent`, `text-foreground`, `border-border`, `bg-card`, `bg-search`, etc.) — do NOT introduce new color tokens
- Use **`@iconify/react`** for icons (e.g. `mdi:home-city`, `mdi:pencil`, `mdi:trash-can`) — do NOT add `lucide-react`
- Use the **Poppins** font (already loaded)
- Follow the existing **French copy** convention (button labels, error messages, page titles)
- **No automated tests** in the project — verify by manual navigation, visual check, and `bun run build` for type safety
- **Commit after each task** with conventional commit messages
- One entity at a time — Propriétés MUST be fully done and visually validated before moving to Visites
- All components must support **dark mode** (default) and **light mode** (opt-in) — use the existing CSS variables, never hardcode hex colors
- `DashboardPageHeader` is the existing header component — keep using it, do not reinvent
- Run `bun run lint` and `bun run build` in `apps/web` after each entity to catch type errors

---

## File Structure

### New files to create (design system — Task 1-2 only)

```
apps/web/
  components/
    primitives/
      Button.tsx
      Card.tsx
      index.ts
    forms/
      FormCard.tsx
      FormField.tsx
      FormTabs.tsx
      FormStepper.tsx
      FormFooter.tsx
      ApiErrorBanner.tsx
      SelectSearch.tsx
      DateField.tsx
      Switcher.tsx
      NumberInput.tsx
      FileUpload.tsx
      Gallery.tsx
      index.ts
    detail/
      DetailCard.tsx
      DetailRow.tsx
      DetailHeader.tsx
      DetailSection.tsx
      index.ts
  hooks/
    use-resource-form.ts
    use-resource-detail.ts
  lib/
    validation/
      required.ts
      numeric.ts
      currency.ts
      date.ts
      email.ts
      phone.ts
      index.ts
```

### Per-entity files (Tasks 3-10, Propriétés first)

```
apps/web/app/owner/properties/
  owner-property-form.tsx         # refactored: uses design system, shared add+edit
  add/page.tsx                    # refactored: thin wrapper around OwnerPropertyForm
  [id]/edit/page.tsx              # NEW: dedicated edit page
  [id]/page.tsx                   # refactored: read-only detail
  [id]/owner-property-detail.tsx  # DELETED after migration
  page.tsx                        # refactored: list uses new components
  owner-properties.tsx            # refactored: list view

apps/web/app/owner/visits/
  ... (same shape, Tasks 11-14)

apps/web/app/owner/leases/
  ... (same shape, Tasks 15-18)

apps/web/app/owner/maintenance/
  ... (same shape, Tasks 19-22)

apps/web/app/owner/payments/
  ... (same shape, Tasks 23-26)

apps/web/app/owner/mandate/
  ... (same shape, Tasks 27-28)

apps/web/app/owner/bookings/
  ... (same shape, Tasks 29-32)

apps/web/app/owner/dashboard/
  ... (Tasks 33-34)
```

---

## Phase 1 — Design system foundation (Tasks 1-2)

### Task 1: Validation helpers + primitive components

**Files:**
- Create: `apps/web/lib/validation/required.ts`
- Create: `apps/web/lib/validation/numeric.ts`
- Create: `apps/web/lib/validation/currency.ts`
- Create: `apps/web/lib/validation/date.ts`
- Create: `apps/web/lib/validation/email.ts`
- Create: `apps/web/lib/validation/phone.ts`
- Create: `apps/web/lib/validation/index.ts`
- Create: `apps/web/components/primitives/Button.tsx`
- Create: `apps/web/components/primitives/Card.tsx`
- Create: `apps/web/components/primitives/index.ts`

**Produces:**
- `validateRequired(value: unknown, label?: string): string | null`
- `validateNumeric(value: string, opts?: { min?: number; max?: number }): string | null`
- `validateCurrency(value: string): string | null`
- `validateDate(value: string): string | null`
- `validateEmail(value: string): string | null`
- `validatePhone(value: string): string | null`
- `<Button variant="primary" | "secondary" | "danger" | "ghost" size="sm" | "md" | "lg" loading? icon?>{children}</Button>`
- `<Card bordered?>{children}</Card>`

- [ ] **Step 1: Create `lib/validation/required.ts`**

```ts
export function validateRequired(value: unknown, label = 'Ce champ'): string | null {
  if (value === null || value === undefined) return `${label} est requis.`;
  if (typeof value === 'string' && value.trim() === '') return `${label} est requis.`;
  if (Array.isArray(value) && value.length === 0) return `${label} est requis.`;
  return null;
}
```

- [ ] **Step 2: Create `lib/validation/numeric.ts`**

```ts
type NumericOpts = { min?: number; max?: number };

export function validateNumeric(value: string, opts: NumericOpts = {}): string | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 'Veuillez saisir un nombre valide.';
  if (opts.min !== undefined && parsed < opts.min) {
    return `La valeur doit être supérieure ou égale à ${opts.min}.`;
  }
  if (opts.max !== undefined && parsed > opts.max) {
    return `La valeur doit être inférieure ou égale à ${opts.max}.`;
  }
  return null;
}

export function parseNumeric(value: string): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
```

- [ ] **Step 3: Create `lib/validation/currency.ts`**

```ts
const CURRENCY_RE = /^\d+(\.\d{1,2})?$/;

export function validateCurrency(value: string): string | null {
  if (value === '') return null;
  if (!CURRENCY_RE.test(value)) return 'Montant invalide (ex: 150000 ou 150000.50).';
  return null;
}

export function parseCurrency(value: string): number {
  return Number(value) || 0;
}
```

- [ ] **Step 4: Create `lib/validation/date.ts`**

```ts
export function validateDate(value: string): string | null {
  if (value === '') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 'Date invalide (format AAAA-MM-JJ attendu).';
  return null;
}

export function validateDateAfter(
  startValue: string,
  endValue: string,
  endLabel = 'La date de fin',
): string | null {
  if (!startValue || !endValue) return null;
  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) return `${endLabel} doit être postérieure à la date de début.`;
  return null;
}
```

- [ ] **Step 5: Create `lib/validation/email.ts`**

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | null {
  if (value === '') return null;
  if (!EMAIL_RE.test(value)) return 'Adresse email invalide.';
  return null;
}
```

- [ ] **Step 6: Create `lib/validation/phone.ts`**

```ts
// Accepts digits, spaces, +, -, parentheses. At least 6 digits.
const PHONE_RE = /^[\d\s+\-()]{6,20}$/;

export function validatePhone(value: string): string | null {
  if (value === '') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return 'Numéro de téléphone trop court.';
  if (!PHONE_RE.test(value)) return 'Numéro de téléphone invalide.';
  return null;
}
```

- [ ] **Step 7: Create `lib/validation/index.ts`**

```ts
export { validateRequired } from './required';
export { validateNumeric, parseNumeric } from './numeric';
export { validateCurrency, parseCurrency } from './currency';
export { validateDate, validateDateAfter } from './date';
export { validateEmail } from './email';
export { validatePhone } from './phone';
```

- [ ] **Step 8: Create `components/primitives/Button.tsx`**

```tsx
'use client';

import { Icon } from '@iconify/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-light focus:bg-accent-light disabled:bg-accent/50',
  secondary:
    'bg-card text-foreground border border-border hover:bg-card-hover disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
  ghost:
    'bg-transparent text-foreground hover:bg-card-hover disabled:opacity-50',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent/40',
        'disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
      ) : icon ? (
        <Icon icon={icon} className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
}
```

- [ ] **Step 9: Create `components/primitives/Card.tsx`**

```tsx
import type { ReactNode } from 'react';

type CardProps = {
  bordered?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({
  bordered = true,
  className = '',
  children,
}: CardProps): React.JSX.Element {
  return (
    <div
      className={[
        'rounded-2xl bg-card',
        bordered ? 'border border-border' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 10: Create `components/primitives/index.ts`**

```ts
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
```

- [ ] **Step 11: Type-check and commit**

```bash
cd apps/web && bun run lint
git add apps/web/lib/validation apps/web/components/primitives
git commit -m "feat(web): validation helpers and primitive components

Add shared validation utilities (required, numeric, currency, date,
email, phone) and Preline-styled Button and Card primitives for the
new owner dashboard design system."
```

Expected: `bun run lint` passes. Commit succeeds.

---

### Task 2: Form components (FormCard, FormField, FormTabs, FormStepper, FormFooter, ApiErrorBanner) + form hooks

**Files:**
- Create: `apps/web/hooks/use-resource-form.ts`
- Create: `apps/web/hooks/use-resource-detail.ts`
- Create: `apps/web/components/forms/FormCard.tsx`
- Create: `apps/web/components/forms/FormField.tsx`
- Create: `apps/web/components/forms/FormTabs.tsx`
- Create: `apps/web/components/forms/FormStepper.tsx`
- Create: `apps/web/components/forms/FormFooter.tsx`
- Create: `apps/web/components/forms/ApiErrorBanner.tsx`
- Create: `apps/web/components/forms/index.ts`

**Consumes (from Task 1):**
- `Button` from `@/components/primitives`
- `Card` from `@/components/primitives`

**Produces:**
- `useResourceForm<T>(opts) => { values, errors, saving, submitError, setField, setValues, handleSubmit, reset }`
- `useResourceDetail<T>(loader) => { data, loading, error, reload, setData }`
- `<FormCard title, hint?, footer?>{children}</FormCard>`
- `<FormField name, label, error?, required?, hint?, children>` — controlled wrapper that displays label + error
- `<FormTabs tabs, defaultTab?, onChange?>` — Preline-styled tabs
- `<FormStepper steps, currentStep, onStepClick?>` — horizontal numbered stepper
- `<FormFooter onSubmit?, onCancel?, submitLabel, cancelLabel?, saving, disabled?>` — sticky bottom action bar
- `<ApiErrorBanner message>`

- [ ] **Step 1: Create `hooks/use-resource-form.ts`**

```ts
'use client';

import { useCallback, useState, type FormEvent } from 'react';

export type UseResourceFormOptions<T> = {
  initial: T;
  onSubmit: (values: T) => Promise<void>;
  validate?: (values: T) => Record<string, string>;
};

export type UseResourceFormResult<T> = {
  values: T;
  errors: Record<string, string>;
  saving: boolean;
  submitError: string | null;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  setValues: (values: T) => void;
  setError: (name: string, message: string) => void;
  handleSubmit: (e?: FormEvent) => Promise<void>;
  reset: () => void;
};

export function useResourceForm<T extends Record<string, unknown>>(
  opts: UseResourceFormOptions<T>,
): UseResourceFormResult<T> {
  const [values, setValues] = useState<T>(opts.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const setError = useCallback((name: string, message: string) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const validationErrors = opts.validate?.(values) ?? {};
      if (Object.values(validationErrors).some(Boolean)) {
        setErrors(validationErrors);
        return;
      }
      setSaving(true);
      setSubmitError(null);
      try {
        await opts.onSubmit(values);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Une erreur est survenue. Veuillez réessayer.';
        setSubmitError(message);
      } finally {
        setSaving(false);
      }
    },
    [opts, values],
  );

  const reset = useCallback(() => {
    setValues(opts.initial);
    setErrors({});
    setSubmitError(null);
  }, [opts.initial]);

  return {
    values,
    errors,
    saving,
    submitError,
    setField,
    setValues,
    setError,
    handleSubmit,
    reset,
  };
}
```

- [ ] **Step 2: Create `hooks/use-resource-detail.ts`**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

type UseResourceDetailResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: (data: T) => void;
};

export function useResourceDetail<T>(
  loader: () => Promise<T>,
): UseResourceDetailResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les données.',
      );
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}
```

- [ ] **Step 3: Create `components/forms/ApiErrorBanner.tsx`**

```tsx
import { Icon } from '@iconify/react';

type ApiErrorBannerProps = {
  message: string | null | undefined;
  className?: string;
};

export function ApiErrorBanner({
  message,
  className = '',
}: ApiErrorBannerProps): React.JSX.Element | null {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={[
        'mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger',
        className,
      ].join(' ')}
    >
      <Icon icon="mdi:alert-circle" className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/forms/FormCard.tsx`**

```tsx
import { Card } from '@/components/primitives';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

type FormCardProps = {
  title: string;
  hint?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormCard({
  title,
  hint,
  footer,
  className = '',
  children,
}: FormCardProps): React.JSX.Element {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="border-b-4 border-t-0 border-accent">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {hint ? (
              <span title={hint} className="text-muted">
                <Icon icon="mdi:information-outline" className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-5 md:p-6">{children}</div>
        {footer ? (
          <div className="border-t border-border bg-card-hover px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Create `components/forms/FormField.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

type FormFieldProps = {
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

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function Input({ invalid = false, className = '', ...rest }: InputProps) {
  return (
    <input
      className={`${invalid ? FIELD_ERROR_CLASS : FIELD_INPUT_CLASS} ${className}`}
      {...rest}
    />
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
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

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export function Select({ invalid = false, className = '', children, ...rest }: SelectProps) {
  return (
    <select
      className={`${invalid ? FIELD_ERROR_CLASS : FIELD_INPUT_CLASS} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
```

- [ ] **Step 6: Create `components/forms/FormTabs.tsx`**

```tsx
'use client';

import { Icon } from '@iconify/react';
import { useState, type ReactNode } from 'react';

export type FormTab = {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  disabled?: boolean;
};

type FormTabsProps = {
  tabs: FormTab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
};

export function FormTabs({
  tabs,
  defaultTab,
  onChange,
}: FormTabsProps): React.JSX.Element {
  const [activeId, setActiveId] = useState<string>(
    defaultTab ?? tabs[0]?.id ?? '',
  );

  const handleSelect = (id: string) => {
    if (tabs.find((t) => t.id === id)?.disabled) return;
    setActiveId(id);
    onChange?.(id);
  };

  const active = tabs.find((t) => t.id === activeId);

  return (
    <div>
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => handleSelect(tab.id)}
              className={[
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-foreground',
                tab.disabled ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              {tab.icon ? <Icon icon={tab.icon} className="h-4 w-4" /> : null}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="pt-5">{active?.content}</div>
    </div>
  );
}
```

- [ ] **Step 7: Create `components/forms/FormStepper.tsx`**

```tsx
import { Icon } from '@iconify/react';

export type FormStepperStep = {
  id: string;
  label: string;
};

type FormStepperProps = {
  steps: FormStepperStep[];
  currentStep: string;
  onStepClick?: (stepId: string) => void;
};

export function FormStepper({
  steps,
  currentStep,
  onStepClick,
}: FormStepperProps): React.JSX.Element {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  return (
    <ol className="flex w-full items-center gap-2 overflow-x-auto py-2">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isActive = index === currentIndex;
        const handleClick = () => {
          if (index <= currentIndex) onStepClick?.(step.id);
        };
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={index > currentIndex}
              className={[
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : isComplete
                    ? 'bg-accent/15 text-accent'
                    : 'bg-card-hover text-muted',
                index > currentIndex ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
                {isComplete ? (
                  <Icon icon="mdi:check" className="h-3 w-3" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <div
                aria-hidden
                className={[
                  'h-px flex-1',
                  isComplete ? 'bg-accent/50' : 'bg-border',
                ].join(' ')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 8: Create `components/forms/FormFooter.tsx`**

```tsx
import { Button } from '@/components/primitives';

type FormFooterProps = {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel: string;
  cancelLabel?: string;
  saving?: boolean;
  disabled?: boolean;
  submitIcon?: string;
};

export function FormFooter({
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel = 'Annuler',
  saving = false,
  disabled = false,
  submitIcon = 'mdi:content-save',
}: FormFooterProps): React.JSX.Element {
  return (
    <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
      {onCancel ? (
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          {cancelLabel}
        </Button>
      ) : null}
      {onSubmit ? (
        <Button
          type="submit"
          variant="primary"
          onClick={onSubmit}
          loading={saving}
          disabled={disabled || saving}
          icon={submitIcon}
        >
          {submitLabel}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 9: Create `components/forms/index.ts`**

```ts
export { ApiErrorBanner, type ApiErrorBannerProps } from './ApiErrorBanner';
export { FormCard, type FormCardProps } from './FormCard';
export {
  FormField,
  Input,
  Textarea,
  Select,
  type FormFieldProps,
  type InputProps,
  type TextareaProps,
  type SelectProps,
} from './FormField';
export { FormTabs, type FormTab, type FormTabsProps } from './FormTabs';
export { FormStepper, type FormStepperStep, type FormStepperProps } from './FormStepper';
export { FormFooter, type FormFooterProps } from './FormFooter';
```

- [ ] **Step 10: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/hooks/use-resource-form.ts apps/web/hooks/use-resource-detail.ts apps/web/components/forms
git commit -m "feat(web): form design system and resource hooks

Add FormCard, FormField (Input/Textarea/Select), FormTabs, FormStepper,
FormFooter, ApiErrorBanner, plus the useResourceForm and
useResourceDetail generic hooks. Foundation for the new owner
dashboard forms."
```

Expected: lint passes, build succeeds. Commit OK.

---

### Task 3: Detail components (DetailCard, DetailRow, DetailHeader, DetailSection)

**Files:**
- Create: `apps/web/components/detail/DetailCard.tsx`
- Create: `apps/web/components/detail/DetailRow.tsx`
- Create: `apps/web/components/detail/DetailHeader.tsx`
- Create: `apps/web/components/detail/DetailSection.tsx`
- Create: `apps/web/components/detail/index.ts`

**Consumes (from Task 1):**
- `Card` from `@/components/primitives`
- `Button` from `@/components/primitives`

**Produces:**
- `<DetailCard title, actions?>{children}</DetailCard>`
- `<DetailRow label, value?>{children?}</DetailRow>` — value can be ReactNode (chips, badges, etc.) or string
- `<DetailHeader title, subtitle?, meta?, avatar?, actions?>` — page-level header for detail pages
- `<DetailSection columns?>{children}</DetailSection>` — grid wrapper (defaults to 2 columns at lg)

- [ ] **Step 1: Create `components/detail/DetailCard.tsx`**

```tsx
import { Card } from '@/components/primitives';
import type { ReactNode } from 'react';

type DetailCardProps = {
  title?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function DetailCard({
  title,
  actions,
  className = '',
  children,
}: DetailCardProps): React.JSX.Element {
  return (
    <Card className={`overflow-hidden ${className}`}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          {title ? (
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <dl className="divide-y divide-border">{children}</dl>
    </Card>
  );
}
```

- [ ] **Step 2: Create `components/detail/DetailRow.tsx`**

```tsx
import type { ReactNode } from 'react';

type DetailRowProps = {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DetailRow({
  label,
  value,
  children,
  className = '',
}: DetailRowProps): React.JSX.Element {
  return (
    <div className={`grid gap-1 px-5 py-3.5 md:grid-cols-3 ${className}`}>
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm text-foreground md:col-span-2">
        {children ?? (value === null || value === undefined || value === '' ? '—' : value)}
      </dd>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/detail/DetailHeader.tsx`**

```tsx
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

type DetailHeaderProps = {
  title: string;
  subtitle?: string | ReactNode;
  meta?: string | ReactNode;
  avatar?: string;
  avatarFallback?: string;
  actions?: ReactNode;
};

export function DetailHeader({
  title,
  subtitle,
  meta,
  avatar,
  avatarFallback,
  actions,
}: DetailHeaderProps): React.JSX.Element {
  const initials =
    avatarFallback ??
    title
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-xl font-semibold text-accent">
            {initials || <Icon icon="mdi:image-outline" className="h-7 w-7" />}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
          ) : null}
          {meta ? (
            <div className="mt-1 text-xs text-muted">{meta}</div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/detail/DetailSection.tsx`**

```tsx
import type { ReactNode } from 'react';

type DetailSectionProps = {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
};

const COLS_CLASS: Record<1 | 2 | 3, string> = {
  1: 'grid gap-6',
  2: 'grid gap-6 lg:grid-cols-2',
  3: 'grid gap-6 lg:grid-cols-2 xl:grid-cols-3',
};

export function DetailSection({
  columns = 2,
  className = '',
  children,
}: DetailSectionProps): React.JSX.Element {
  return <div className={`${COLS_CLASS[columns]} ${className}`}>{children}</div>;
}
```

- [ ] **Step 5: Create `components/detail/index.ts`**

```ts
export { DetailCard, type DetailCardProps } from './DetailCard';
export { DetailRow, type DetailRowProps } from './DetailRow';
export { DetailHeader, type DetailHeaderProps } from './DetailHeader';
export { DetailSection, type DetailSectionProps } from './DetailSection';
```

- [ ] **Step 6: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/components/detail
git commit -m "feat(web): detail page design system

Add DetailCard, DetailRow, DetailHeader, DetailSection components
for read-only owner dashboard pages."
```

Expected: lint passes, build succeeds. Commit OK.

---

### Task 4: Specialized form fields (SelectSearch, DateField, Switcher, NumberInput)

**Files:**
- Create: `apps/web/components/forms/SelectSearch.tsx`
- Create: `apps/web/components/forms/DateField.tsx`
- Create: `apps/web/components/forms/Switcher.tsx`
- Create: `apps/web/components/forms/NumberInput.tsx`
- Modify: `apps/web/components/forms/index.ts` — add the new exports

**Produces:**
- `<SelectSearch value, onChange, options, placeholder?, invalid?, disabled?>` — native select with search prompt (server-side filtering for now; native fallback)
- `<DateField name, value, onChange, invalid?, ...rest>` — date input wrapped
- `<Switcher name, checked, onChange, label?, disabled?>` — Preline-style toggle
- `<NumberInput name, value, onChange, min?, max?, step?, invalid?>` — numeric input

- [ ] **Step 1: Create `components/forms/SelectSearch.tsx`**

```tsx
'use client';

import { useState, useMemo } from 'react';

export type SelectSearchOption = {
  value: string;
  label: string;
  hint?: string;
};

type SelectSearchProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectSearchOption[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

export function SelectSearch({
  name,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  invalid = false,
  disabled = false,
  emptyLabel = 'Aucun résultat',
  className = '',
}: SelectSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        role="combobox"
        aria-expanded={false}
        placeholder={current ? current.label : placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className={[
          'block w-full rounded-lg border bg-search px-3 py-2.5 pr-9 text-sm text-foreground placeholder:text-muted',
          'focus:ring-2 focus:outline-none',
          invalid
            ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-input-border focus:border-input-focus-border focus:ring-accent/30',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      />
      <select
        aria-label={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery('');
        }}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent px-3 py-2.5 text-sm text-transparent focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {filtered.length === 0 ? (
          <option value={value} disabled>
            {emptyLabel}
          </option>
        ) : (
          filtered.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/forms/DateField.tsx`**

```tsx
type DateFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function DateField({
  invalid = false,
  className = '',
  ...rest
}: DateFieldProps): React.JSX.Element {
  return (
    <input
      type="date"
      className={[
        'block w-full rounded-lg border bg-search px-3 py-2.5 text-sm text-foreground',
        'focus:ring-2 focus:outline-none',
        invalid
          ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-input-border focus:border-input-focus-border focus:ring-accent/30',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
```

- [ ] **Step 3: Create `components/forms/Switcher.tsx`**

```tsx
type SwitcherProps = {
  name?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Switcher({
  name,
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}: SwitcherProps): React.JSX.Element {
  return (
    <label
      className={[
        'inline-flex cursor-pointer items-center gap-3',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        className,
      ].join(' ')}
    >
      <input
        type="hidden"
        name={name}
        value={checked ? 'true' : 'false'}
      />
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={[
          'relative inline-block h-6 w-11 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      {label ? (
        <span className="text-sm text-foreground">{label}</span>
      ) : null}
    </label>
  );
}
```

- [ ] **Step 4: Create `components/forms/NumberInput.tsx`**

```tsx
type NumberInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function NumberInput({
  invalid = false,
  className = '',
  ...rest
}: NumberInputProps): React.JSX.Element {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={[
        'block w-full rounded-lg border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted',
        'focus:ring-2 focus:outline-none',
        invalid
          ? 'border-danger focus:border-danger focus:ring-danger/30'
          : 'border-input-border focus:border-input-focus-border focus:ring-accent/30',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}
```

- [ ] **Step 5: Update `components/forms/index.ts`**

Replace the file content with:

```ts
export { ApiErrorBanner, type ApiErrorBannerProps } from './ApiErrorBanner';
export { FormCard, type FormCardProps } from './FormCard';
export {
  FormField,
  Input,
  Textarea,
  Select,
  type FormFieldProps,
  type InputProps,
  type TextareaProps,
  type SelectProps,
} from './FormField';
export { FormTabs, type FormTab, type FormTabsProps } from './FormTabs';
export { FormStepper, type FormStepperStep, type FormStepperProps } from './FormStepper';
export { FormFooter, type FormFooterProps } from './FormFooter';
export { SelectSearch, type SelectSearchOption, type SelectSearchProps } from './SelectSearch';
export { DateField, type DateFieldProps } from './DateField';
export { Switcher, type SwitcherProps } from './Switcher';
export { NumberInput, type NumberInputProps } from './NumberInput';
```

- [ ] **Step 6: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/components/forms
git commit -m "feat(web): specialized form fields

Add SelectSearch (with text filter overlay), DateField, Switcher
(toggle), and NumberInput components. Extend the forms barrel."
```

Expected: lint passes, build succeeds. Commit OK.

---

## Phase 2 — Propriétés migration (Tasks 5-9)

### Task 5: Refactor `OwnerPropertyForm` to use the new design system

**Files:**
- Modify: `apps/web/app/owner/properties/owner-property-form.tsx` (full rewrite, ~500 lines → ~350 lines)

**Consumes (from Phase 1):**
- `FormCard`, `FormTabs`, `FormFooter`, `ApiErrorBanner` from `@/components/forms`
- `FormField`, `Input`, `Textarea`, `Select`, `NumberInput`, `Switcher`, `SelectSearch` from `@/components/forms`
- `useResourceForm` from `@/hooks/use-resource-form`
- Validation helpers from `@/lib/validation`
- All existing types and API from `@/lib/owner/properties` and `@/lib/owner/locations`

**Produces:**
- `<OwnerPropertyForm initial?, submitLabel, onSubmit, onCancel?>` — shared between add and edit
- Tabs: "Général", "Localisation", "Visite", "Médias"
- Validates: title (required, min 3), description (required, min 10), price (required, numeric > 0), bedrooms/bathrooms/surface (optional, numeric ≥ 0), quartierId (required), visitPrice (required if visitType=PAID)

**Behavior preservation:**
- Same API calls (`createProperty`, `updateProperty`)
- Same default values (country=CG, city/arrondissement/quartier cascading auto-select)
- Same price unit auto-switch on mode change
- Same media upload via `PropertyMediaUploader`
- Same redirect to detail page on success

- [ ] **Step 1: Read the current file fully to map fields**

```bash
wc -l apps/web/app/owner/properties/owner-property-form.tsx
```

Read the file in full to identify every field, default, and side effect.

- [ ] **Step 2: Write the new file with FormTabs (Général / Localisation / Visite / Médias)**

Replace `apps/web/app/owner/properties/owner-property-form.tsx` content with:

```tsx
'use client';

import { DashboardPageHeader } from '@/components/dashboard';
import {
  ApiErrorBanner,
  DateField,
  FormCard,
  FormField,
  FormFooter,
  FormTabs,
  Input,
  NumberInput,
  Select,
  SelectSearch,
  Switcher,
  Textarea,
  type FormTab,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { useResourceForm } from '@/hooks/use-resource-form';
import { ApiError } from '@/lib/api';
import {
  listArrondissements,
  listCities,
  listQuartiers,
  type PublicArrondissement,
  type PublicCity,
  type PublicQuartier,
} from '@/lib/owner/locations';
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import {
  createProperty,
  defaultPriceUnit,
  propertyModeLabel,
  propertyTypeLabel,
  updateProperty,
  type CreatePropertyInput,
  type PriceUnit,
  type PropertyMode,
  type PropertyType,
  type UpdatePropertyInput,
  type VisitType,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  parseCurrency,
  parseNumeric,
  validateCurrency,
  validateDate,
  validateNumeric,
  validateRequired,
} from '@/lib/validation';

type FormValues = {
  title: string;
  description: string;
  type: PropertyType;
  mode: PropertyMode;
  price: string;
  currency: string;
  priceUnit: PriceUnit;
  address: string;
  bedrooms: string;
  bathrooms: string;
  surface: string;
  visitEnabled: boolean;
  visitType: VisitType;
  visitPrice: string;
  visitDuration: string;
  countryId: string;
  cityId: string;
  arrondissementId: string;
  quartierId: string;
};

const PROPERTY_MODES: PropertyMode[] = ['RENT_LONG', 'RENT_SHORT', 'SALE'];
const PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT',
  'HOUSE',
  'LAND',
  'COMMERCIAL',
];
const PRICE_UNITS: PriceUnit[] = ['NIGHT', 'WEEK', 'MONTH', 'TOTAL'];

const defaultValues = (): FormValues => ({
  title: '',
  description: '',
  type: 'APARTMENT',
  mode: 'RENT_LONG',
  price: '',
  currency: 'XAF',
  priceUnit: 'MONTH',
  address: '',
  bedrooms: '',
  bathrooms: '',
  surface: '',
  visitEnabled: false,
  visitType: 'FREE',
  visitPrice: '',
  visitDuration: '30',
  countryId: '',
  cityId: '',
  arrondissementId: '',
  quartierId: '',
});

const validate = (v: FormValues): Record<string, string> => {
  const e: Record<string, string> = {};
  e.title = validateRequired(v.title, 'Le titre') ?? '';
  if (!e.title && v.title.trim().length < 3) e.title = 'Minimum 3 caractères.';
  e.description = validateRequired(v.description, 'La description') ?? '';
  if (!e.description && v.description.trim().length < 10)
    e.description = 'Minimum 10 caractères.';
  e.price = validateRequired(v.price, 'Le prix') ?? validateCurrency(v.price) ?? '';
  if (!e.price) {
    const n = parseCurrency(v.price);
    if (n <= 0) e.price = 'Le prix doit être supérieur à 0.';
  }
  e.bedrooms = validateNumeric(v.bedrooms, { min: 0 }) ?? '';
  e.bathrooms = validateNumeric(v.bathrooms, { min: 0 }) ?? '';
  e.surface = validateNumeric(v.surface, { min: 0 }) ?? '';
  e.quartierId = validateRequired(v.quartierId, 'Le quartier') ?? '';
  e.visitDuration = validateNumeric(v.visitDuration, { min: 5, max: 240 }) ?? '';
  e.visitPrice =
    v.visitEnabled && v.visitType === 'PAID'
      ? validateRequired(v.visitPrice, 'Le tarif de visite') ??
        validateCurrency(v.visitPrice) ??
        ''
      : '';
  return e;
};

const toCreateInput = (v: FormValues): CreatePropertyInput => {
  const base = {
    title: v.title.trim(),
    description: v.description.trim(),
    type: v.type,
    mode: v.mode,
    price: parseCurrency(v.price),
    currency: v.currency.trim().toUpperCase(),
    priceUnit: v.priceUnit,
    quartierId: v.quartierId,
    address: v.address.trim(),
    countryId: v.countryId,
  };
  const optional: Partial<CreatePropertyInput> = {};
  const bedrooms = parseNumeric(v.bedrooms);
  const bathrooms = parseNumeric(v.bathrooms);
  const surface = parseNumeric(v.surface);
  if (bedrooms !== null) optional.bedrooms = bedrooms;
  if (bathrooms !== null) optional.bathrooms = bathrooms;
  if (surface !== null) optional.surface = surface;
  const visit = v.visitEnabled
    ? {
        visitType: v.visitType,
        visitDuration: parseNumeric(v.visitDuration) ?? 30,
        ...(v.visitType === 'PAID' && v.visitPrice
          ? { visitPrice: parseCurrency(v.visitPrice) }
          : {}),
      }
    : { visitEnabled: false };
  return { ...base, ...optional, ...visit } as CreatePropertyInput;
};

const toUpdateInput = (v: FormValues): UpdatePropertyInput => ({
  title: v.title.trim(),
  description: v.description.trim(),
  price: parseCurrency(v.price),
  address: v.address.trim(),
  visitEnabled: v.visitEnabled,
  ...(v.visitEnabled
    ? {
        visitType: v.visitType,
        visitDuration: parseNumeric(v.visitDuration) ?? 30,
        ...(v.visitType === 'PAID' && v.visitPrice
          ? { visitPrice: parseCurrency(v.visitPrice) }
          : {}),
      }
    : {}),
});

export type OwnerPropertyFormProps = {
  initial?: Partial<FormValues>;
  propertyId?: string;
  submitLabel: string;
  onCancel?: () => void;
};

export function OwnerPropertyForm({
  initial,
  propertyId,
  submitLabel,
  onCancel,
}: OwnerPropertyFormProps): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [cities, setCities] = useState<PublicCity[]>([]);
  const [arrondissements, setArrondissements] = useState<PublicArrondissement[]>([]);
  const [quartiers, setQuartiers] = useState<PublicQuartier[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const form = useResourceForm<FormValues>({
    initial: { ...defaultValues(), ...initial },
    validate,
    onSubmit: async (values) => {
      if (propertyId) {
        await updateProperty(propertyId, toUpdateInput(values));
        router.push(ROUTES.owner.property(propertyId));
      } else {
        const created = await createProperty(toCreateInput(values));
        router.push(ROUTES.owner.property(created.id));
      }
    },
  });

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setLoadingLocations(true);
      try {
        const cityList = await listCities('CG');
        setCities(cityList);
        if (!form.values.countryId && cityList[0]) {
          form.setField('countryId', cityList[0].country.id);
        }
        if (!form.values.cityId && cityList[0]) {
          form.setField('cityId', cityList[0].id);
        }
      } catch (err) {
        form.setError(
          'locations',
          err instanceof ApiError ? err.message : 'Impossible de charger les villes.',
        );
      } finally {
        setLoadingLocations(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!form.values.cityId) {
      setArrondissements([]);
      form.setField('arrondissementId', '');
      return;
    }
    void listArrondissements(form.values.cityId).then((items) => {
      setArrondissements(items);
      if (!form.values.arrondissementId && items[0]) {
        form.setField('arrondissementId', items[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.cityId]);

  useEffect(() => {
    if (!form.values.arrondissementId) {
      setQuartiers([]);
      form.setField('quartierId', '');
      return;
    }
    void listQuartiers(form.values.arrondissementId).then((items) => {
      setQuartiers(items);
      if (!form.values.quartierId && items[0]) {
        form.setField('quartierId', items[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.arrondissementId]);

  useEffect(() => {
    form.setField('priceUnit', defaultPriceUnit(form.values.mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.mode]);

  const tabs: FormTab[] = [
    {
      id: 'general',
      label: 'Général',
      icon: 'mdi:home-city',
      content: (
        <div className="space-y-4">
          <FormField name="title" label="Titre" required error={form.errors.title}>
            <Input
              id="title"
              value={form.values.title}
              onChange={(e) => form.setField('title', e.target.value)}
              placeholder="Appartement 3 pièces, Bacongo"
              invalid={!!form.errors.title}
            />
          </FormField>
          <FormField
            name="description"
            label="Description"
            required
            error={form.errors.description}
          >
            <Textarea
              id="description"
              rows={4}
              value={form.values.description}
              onChange={(e) => form.setField('description', e.target.value)}
              placeholder="Décrivez le bien, les équipements, l'accès…"
              invalid={!!form.errors.description}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="mode" label="Mode" required>
              <Select
                id="mode"
                value={form.values.mode}
                onChange={(e) => form.setField('mode', e.target.value as PropertyMode)}
              >
                {PROPERTY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {propertyModeLabel(m)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="type" label="Type de bien" required>
              <Select
                id="type"
                value={form.values.type}
                onChange={(e) => form.setField('type', e.target.value as PropertyType)}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabel(t)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              name="price"
              label="Prix"
              required
              error={form.errors.price}
              className="sm:col-span-2"
            >
              <NumberInput
                id="price"
                min={0}
                value={form.values.price}
                onChange={(e) => form.setField('price', e.target.value)}
                invalid={!!form.errors.price}
              />
            </FormField>
            <FormField name="currency" label="Devise">
              <Input
                id="currency"
                value={form.values.currency}
                onChange={(e) => form.setField('currency', e.target.value)}
                placeholder="XAF"
              />
            </FormField>
          </div>
          <FormField name="priceUnit" label="Unité de prix">
            <Select
              value={form.values.priceUnit}
              onChange={(e) => form.setField('priceUnit', e.target.value as PriceUnit)}
            >
              {PRICE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      ),
    },
    {
      id: 'location',
      label: 'Localisation',
      icon: 'mdi:map-marker',
      content: (
        <div className="space-y-4">
          <FormField name="address" label="Adresse" required>
            <Input
              id="address"
              value={form.values.address}
              onChange={(e) => form.setField('address', e.target.value)}
              placeholder="Rue, numéro, repère"
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="cityId" label="Ville">
              <SelectSearch
                name="cityId"
                value={form.values.cityId}
                onChange={(v) => form.setField('cityId', v)}
                options={cities.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Sélectionner une ville"
                disabled={loadingLocations}
              />
            </FormField>
            <FormField name="arrondissementId" label="Arrondissement">
              <SelectSearch
                name="arrondissementId"
                value={form.values.arrondissementId}
                onChange={(v) => form.setField('arrondissementId', v)}
                options={arrondissements.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
                placeholder="Sélectionner un arrondissement"
                disabled={!form.values.cityId}
              />
            </FormField>
          </div>
          <FormField
            name="quartierId"
            label="Quartier"
            required
            error={form.errors.quartierId}
          >
            <SelectSearch
              name="quartierId"
              value={form.values.quartierId}
              onChange={(v) => form.setField('quartierId', v)}
              options={quartiers.map((q) => ({ value: q.id, label: q.name }))}
              placeholder="Sélectionner un quartier"
              invalid={!!form.errors.quartierId}
              disabled={!form.values.arrondissementId}
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'characteristics',
      label: 'Caractéristiques',
      icon: 'mdi:format-list-bulleted',
      content: (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField name="bedrooms" label="Chambres" error={form.errors.bedrooms}>
            <NumberInput
              id="bedrooms"
              min={0}
              value={form.values.bedrooms}
              onChange={(e) => form.setField('bedrooms', e.target.value)}
              invalid={!!form.errors.bedrooms}
            />
          </FormField>
          <FormField
            name="bathrooms"
            label="Salles de bain"
            error={form.errors.bathrooms}
          >
            <NumberInput
              id="bathrooms"
              min={0}
              value={form.values.bathrooms}
              onChange={(e) => form.setField('bathrooms', e.target.value)}
              invalid={!!form.errors.bathrooms}
            />
          </FormField>
          <FormField name="surface" label="Surface (m²)" error={form.errors.surface}>
            <NumberInput
              id="surface"
              min={0}
              value={form.values.surface}
              onChange={(e) => form.setField('surface', e.target.value)}
              invalid={!!form.errors.surface}
            />
          </FormField>
        </div>
      ),
    },
    {
      id: 'visit',
      label: 'Visite',
      icon: 'mdi:calendar-clock',
      content: (
        <div className="space-y-4">
          <FormField name="visitEnabled" label="Activer les visites">
            <Switcher
              checked={form.values.visitEnabled}
              onChange={(v) => form.setField('visitEnabled', v)}
              label={form.values.visitEnabled ? 'Visites activées' : 'Visites désactivées'}
            />
          </FormField>
          {form.values.visitEnabled ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="visitType" label="Type de visite" required>
                  <Select
                    value={form.values.visitType}
                    onChange={(e) =>
                      form.setField('visitType', e.target.value as VisitType)
                    }
                  >
                    <option value="FREE">Gratuite</option>
                    <option value="PAID">Payante</option>
                  </Select>
                </FormField>
                <FormField
                  name="visitDuration"
                  label="Durée (min)"
                  required
                  error={form.errors.visitDuration}
                >
                  <NumberInput
                    min={5}
                    max={240}
                    value={form.values.visitDuration}
                    onChange={(e) => form.setField('visitDuration', e.target.value)}
                    invalid={!!form.errors.visitDuration}
                  />
                </FormField>
              </div>
              {form.values.visitType === 'PAID' ? (
                <FormField
                  name="visitPrice"
                  label="Tarif (XAF)"
                  required
                  error={form.errors.visitPrice}
                >
                  <NumberInput
                    min={0}
                    value={form.values.visitPrice}
                    onChange={(e) => form.setField('visitPrice', e.target.value)}
                    invalid={!!form.errors.visitPrice}
                  />
                </FormField>
              ) : null}
            </>
          ) : null}
        </div>
      ),
    },
    {
      id: 'media',
      label: 'Médias',
      icon: 'mdi:image-multiple',
      content: propertyId ? (
        <PropertyMediaUploader propertyId={propertyId} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card-hover p-6 text-center text-sm text-muted">
          Vous pourrez ajouter des photos et vidéos après avoir créé le bien.
        </p>
      ),
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    void form.handleSubmit(e);
  };

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={propertyId ? 'Modifier le bien' : 'Ajouter un bien'}
        subtitle={
          propertyId
            ? 'Mettez à jour les informations de votre bien.'
            : 'Renseignez les informations pour publier un nouveau bien.'
        }
      />
      <ApiErrorBanner message={form.submitError} />
      <FormCard
        title="Informations du bien"
        hint="Les champs marqués d'un astérisque sont obligatoires."
        footer={
          <FormFooter
            onSubmit={() => form.handleSubmit()}
            onCancel={onCancel ?? (() => router.back())}
            submitLabel={submitLabel}
            saving={form.saving}
          />
        }
      >
        <form onSubmit={handleSubmit} className="space-y-2">
          <FormTabs tabs={tabs} />
        </form>
      </FormCard>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/app/owner/properties/owner-property-form.tsx
git commit -m "refactor(web): migrate OwnerPropertyForm to design system

- Use FormCard + FormTabs + FormFooter + ApiErrorBanner
- Use useResourceForm hook for state and validation
- Use FormField + Input/Textarea/Select/NumberInput/Switcher
- Add Caractéristiques tab (bedrooms/bathrooms/surface)
- Keep all existing behavior (location cascade, price unit,
  visit pricing, media uploader)"
```

Expected: lint passes, build succeeds. Commit OK.

- [ ] **Step 4: Manual smoke test**

Start the dev server: `cd apps/web && bun run dev` (background it). Open `/owner/properties/add`. Verify:
- Page loads without errors
- All 5 tabs visible (Général, Localisation, Caractéristiques, Visite, Médias)
- Form fields styled with rounded corners and consistent spacing
- Validation errors appear in red below fields
- Submit triggers API call and redirects to detail page

Stop the dev server before continuing.

---

### Task 6: Create dedicated edit page `[id]/edit/page.tsx`

**Files:**
- Create: `apps/web/app/owner/properties/[id]/edit/page.tsx`

**Consumes (from Task 5):**
- `OwnerPropertyForm` from `@/app/owner/properties/owner-property-form`

- [ ] **Step 1: Create the page**

```tsx
import { OwnerPropertyForm } from '../../owner-property-form';
import { getProperty, type PublicProperty } from '@/lib/owner/properties';
import { ApiError } from '@/lib/api';
import { notFound } from 'next/navigation';

type SearchParams = Promise<{ error?: string }>;

async function loadInitial(
  id: string,
): Promise<{ initial: Partial<PublicProperty> } | { notFound: true }> {
  try {
    const property = await getProperty(id);
    return {
      initial: {
        title: property.title,
        description: property.description,
        type: property.type,
        mode: property.mode,
        price: String(property.price),
        currency: property.currency,
        priceUnit: property.priceUnit,
        address: property.address,
        bedrooms: property.bedrooms ? String(property.bedrooms) : '',
        bathrooms: property.bathrooms ? String(property.bathrooms) : '',
        surface: property.surface ? String(property.surface) : '',
        visitEnabled: property.visitEnabled,
        visitType: property.visitType,
        visitPrice: property.visitPrice ? String(property.visitPrice) : '',
        visitDuration: String(property.visitDuration),
        cityId: property.city?.id ?? '',
        arrondissementId: property.arrondissement?.id ?? '',
        quartierId: property.quartier?.id ?? '',
        countryId: property.country?.id ?? '',
      },
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { notFound: true };
    }
    throw err;
  }
}

export default async function OwnerPropertyEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const result = await loadInitial(id);
  if ('notFound' in result) {
    notFound();
  }
  return (
    <OwnerPropertyForm
      propertyId={id}
      initial={result.initial as never}
      submitLabel="Enregistrer"
    />
  );
}
```

- [ ] **Step 2: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/app/owner/properties/\[id\]/edit
git commit -m "feat(web): dedicated property edit page

Create /owner/properties/[id]/edit that loads the property and
delegates to OwnerPropertyForm. Replaces the inline editing mode
that was previously embedded in the detail page."
```

Expected: lint passes, build succeeds. Commit OK.

- [ ] **Step 3: Manual smoke test**

Start dev: `cd apps/web && bun run dev` (background). Navigate to `/owner/properties/<existing-id>/edit`. Verify:
- Page loads with prefilled values
- All tabs work
- Save redirects to detail page with updated values

Stop dev server.

---

### Task 7: Refactor the detail page `[id]/page.tsx` to read-only

**Files:**
- Modify: `apps/web/app/owner/properties/[id]/page.tsx` (full rewrite)
- Delete: `apps/web/app/owner/properties/[id]/owner-property-detail.tsx`

**Consumes (from Phase 1):**
- `DetailCard`, `DetailRow`, `DetailHeader`, `DetailSection` from `@/components/detail`
- `useResourceDetail` from `@/hooks/use-resource-detail`
- `Button` from `@/components/primitives`
- `ApiErrorBanner` from `@/components/forms`
- `DashboardPageHeader` from `@/components/dashboard`

- [ ] **Step 1: Replace `page.tsx` with a thin client wrapper that uses a new `<OwnerPropertyDetailView>`**

Replace `apps/web/app/owner/properties/[id]/page.tsx` content with:

```tsx
import { OwnerPropertyDetailView } from './owner-property-detail-view';

export default async function OwnerBienDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerPropertyDetailView propertyId={id} />;
}
```

- [ ] **Step 2: Create `apps/web/app/owner/properties/[id]/owner-property-detail-view.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/primitives';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import {
  DetailCard,
  DetailRow,
  DetailHeader,
  DetailSection,
} from '@/components/detail';
import { useResourceDetail } from '@/hooks/use-resource-detail';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { PropertyMediaUploader } from '@/components/owner/property-media-uploader';
import { listMedia, type MediaItem } from '@/lib/owner/media';
import {
  archiveProperty,
  formatPropertyPrice,
  pauseProperty,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  propertyTypeLabel,
  publishProperty,
  getProperty,
  type PublicProperty,
} from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';

type ViewState = {
  property: PublicProperty | null;
  media: MediaItem[];
  loading: boolean;
  error: string | null;
};

export function OwnerPropertyDetailView({
  propertyId,
}: {
  propertyId: string;
}): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useResourceDetail(async () => {
    const [property, media] = await Promise.all([
      getProperty(propertyId),
      listMedia(propertyId),
    ]);
    return { property, media };
  });

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  const property = data?.property ?? null;
  const media = data?.media ?? [];

  if (error || !property) {
    return <ApiErrorBanner message={error ?? 'Bien introuvable.'} />;
  }

  const runAction = async (
    key: string,
    fn: () => Promise<unknown>,
  ): Promise<void> => {
    setActionBusy(key);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : 'Action impossible. Veuillez réessayer.',
      );
    } finally {
      setActionBusy(null);
    }
  };

  const canPublish = property.status === 'DRAFT' || property.status === 'PAUSED';
  const canPause = property.status === 'PUBLISHED';
  const canArchive = property.status !== 'ARCHIVED';

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={property.title}
        subtitle={`${propertyTypeLabel(property.type)} · ${propertyModeLabel(property.mode)}`}
        backHref={ROUTES.owner.properties}
        backLabel="Mes biens"
      />

      <DetailHeader
        title={property.title}
        subtitle={`${propertyTypeLabel(property.type)} · ${propertyModeLabel(property.mode)}`}
        meta={
          <StatusBadge
            label={propertyStatusLabel(property.status)}
            tone={propertyStatusTone(property.status)}
          />
        }
        avatar={property.coverImage}
        actions={
          <>
            <Link href={ROUTES.owner.propertyEdit(propertyId)}>
              <Button icon="mdi:pencil" variant="primary">
                Modifier
              </Button>
            </Link>
            {canPublish ? (
              <Button
                icon="mdi:check-circle-outline"
                variant="secondary"
                loading={actionBusy === 'publish'}
                onClick={() =>
                  runAction('publish', () => publishProperty(propertyId))
                }
              >
                Publier
              </Button>
            ) : null}
            {canPause ? (
              <Button
                icon="mdi:pause-circle-outline"
                variant="secondary"
                loading={actionBusy === 'pause'}
                onClick={() => runAction('pause', () => pauseProperty(propertyId))}
              >
                Mettre en pause
              </Button>
            ) : null}
            {canArchive ? (
              <Button
                icon="mdi:archive-outline"
                variant="danger"
                loading={actionBusy === 'archive'}
                onClick={() =>
                  runAction('archive', () => archiveProperty(propertyId))
                }
              >
                Archiver
              </Button>
            ) : null}
          </>
        }
      />

      <ApiErrorBanner message={actionError} />

      <DetailSection>
        <DetailCard title="Informations générales">
          <DetailRow label="Description" value={property.description} />
          <DetailRow
            label="Prix"
            value={formatPropertyPrice(property)}
          />
          <DetailRow
            label="Devise"
            value={property.currency}
          />
          <DetailRow
            label="Chambres"
            value={property.bedrooms ?? '—'}
          />
          <DetailRow
            label="Salles de bain"
            value={property.bathrooms ?? '—'}
          />
          <DetailRow
            label="Surface"
            value={property.surface ? `${property.surface} m²` : '—'}
          />
        </DetailCard>

        <DetailCard title="Localisation">
          <DetailRow label="Adresse" value={property.address} />
          <DetailRow label="Ville" value={property.city?.name} />
          <DetailRow
            label="Arrondissement"
            value={property.arrondissement?.name}
          />
          <DetailRow label="Quartier" value={property.quartier?.name} />
          <DetailRow label="Pays" value={property.country?.name} />
        </DetailCard>
      </DetailSection>

      <DetailCard title="Visite">
        <DetailRow
          label="Visite activée"
          value={property.visitEnabled ? 'Oui' : 'Non'}
        />
        {property.visitEnabled ? (
          <>
            <DetailRow
              label="Type"
              value={property.visitType === 'PAID' ? 'Payante' : 'Gratuite'}
            />
            <DetailRow
              label="Durée"
              value={`${property.visitDuration} min`}
            />
            {property.visitType === 'PAID' ? (
              <DetailRow
                label="Tarif"
                value={property.visitPrice ? `${property.visitPrice} ${property.currency}` : '—'}
              />
            ) : null}
          </>
        ) : null}
      </DetailCard>

      <DetailCard title="Médias" actions={null}>
        <div className="p-5">
          <PropertyMediaUploader propertyId={propertyId} />
          {media.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              {media.length} média{media.length > 1 ? 's' : ''} attaché
              {media.length > 1 ? 's' : ''}.
            </p>
          ) : null}
        </div>
      </DetailCard>
    </div>
  );
}
```

- [ ] **Step 3: Verify `ROUTES.owner.propertyEdit` exists, add if missing**

Open `apps/web/lib/routes.ts`. Search for `propertyEdit` export. If absent, add it next to other `property*` routes:

```ts
propertyEdit: (id: string) => `/owner/properties/${id}/edit`,
```

- [ ] **Step 4: Delete the legacy `owner-property-detail.tsx` file**

```bash
git rm apps/web/app/owner/properties/\[id\]/owner-property-detail.tsx
```

- [ ] **Step 5: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/app/owner/properties/\[id\]/page.tsx apps/web/app/owner/properties/\[id\]/owner-property-detail-view.tsx apps/web/lib/routes.ts
git commit -m "refactor(web): read-only property detail page

Replace the legacy owner-property-detail.tsx (which mixed read-only
display and inline editing) with a dedicated detail view using
DetailCard/DetailRow/DetailHeader/DetailSection. Editing now lives
exclusively at /owner/properties/[id]/edit."
```

Expected: lint passes, build succeeds. Commit OK.

- [ ] **Step 6: Manual smoke test**

Start dev: `cd apps/web && bun run dev` (background). Open `/owner/properties/<id>`. Verify:
- Header shows title, type/mode subtitle, status badge
- Action buttons (Modifier, Publier/Pause, Archiver) render correctly
- Sections are in cards with consistent borders
- Clicking "Modifier" navigates to `/edit`
- Status changes via action buttons work

Stop dev server.

---

### Task 8: Refactor the property list page

**Files:**
- Modify: `apps/web/app/owner/properties/owner-properties.tsx` (UI polish only — keep existing API)
- Modify: `apps/web/app/owner/properties/page.tsx` (no change expected — just verify it still imports correctly)

**Behavior preservation:**
- Same data loading via `listMyProperties`
- Same publish/pause/archive actions
- Same navigation to detail page
- Same filters / search (if any)

**UI changes:**
- Wrap the page in the new design system aesthetic (status badges already OK)
- Improve the "Ajouter" CTA placement
- Empty state with illustration + primary button

- [ ] **Step 1: Read the current file to inventory current behavior**

```bash
wc -l apps/web/app/owner/properties/owner-properties.tsx
```

Read the file. Identify:
- How rows are displayed (table? cards?)
- The "add" button location
- Empty state handling
- Action buttons per row

- [ ] **Step 2: Apply targeted UI changes**

Apply ONLY these specific changes (preserve all existing data flow and action handlers):

1. **Empty state**: replace any plain "Aucun bien" message with a card-style empty state:
   ```tsx
   {!loading && rows.length === 0 ? (
     <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
       <Icon icon="mdi:home-city-outline" className="mx-auto h-12 w-12 text-muted" />
       <h3 className="mt-3 text-base font-semibold text-foreground">Aucun bien</h3>
       <p className="mt-1 text-sm text-muted">
         Commencez par ajouter votre premier bien immobilier.
       </p>
       <Link href={ROUTES.owner.propertyNew} className="mt-4 inline-block">
         <Button icon="mdi:plus" variant="primary">
           Ajouter un bien
         </Button>
       </Link>
     </div>
   ) : null}
   ```

2. **Add button at top of page** (next to header): add a primary action button when `rows.length > 0`:
   ```tsx
   <div className="flex justify-end">
     <Link href={ROUTES.owner.propertyNew}>
       <Button icon="mdi:plus" variant="primary">
         Ajouter un bien
       </Button>
     </Link>
   </div>
   ```

3. **Error state**: wrap the error in `ApiErrorBanner`:
   ```tsx
   <ApiErrorBanner message={error} />
   ```

- [ ] **Step 3: Type-check, build, commit**

```bash
cd apps/web && bun run lint
cd apps/web && bun run build
git add apps/web/app/owner/properties/owner-properties.tsx
git commit -m "refactor(web): polish property list UI

Use ApiErrorBanner for errors, add an empty state card with CTA,
add a top-right 'Ajouter' button. Preserve all existing data
loading and action handlers."
```

Expected: lint passes, build succeeds. Commit OK.

- [ ] **Step 4: Manual smoke test**

Start dev. Open `/owner/properties`. Verify:
- Empty state shows the new card (if no properties)
- "Ajouter un bien" button visible and navigates to `/add`
- Rows show status badge correctly
- Action buttons (publish/pause/archive) work

Stop dev server.

---

### Task 9: Propriétés visual validation & commit

**Files:**
- (no file changes — verification task)

- [ ] **Step 1: Full owner flow walkthrough**

Start dev. Walk through:
1. `/owner/properties` — list shows correctly
2. Click "Ajouter un bien" → `/owner/properties/add` — form loads, all 5 tabs visible
3. Fill the form (tab by tab), submit → redirected to detail page
4. On detail page, click "Modifier" → edit form prefilled
5. Change a value, save → back to detail with updated value
6. Click "Publier" / "Mettre en pause" / "Archiver" — status badge updates
7. Toggle dark/light in browser — colors look good in both

- [ ] **Step 2: Capture before/after screenshots for review**

Take a screenshot of the detail page and the form page. Save to a temporary location for the user to review.

- [ ] **Step 3: Tag the milestone**

```bash
git tag owner-proprietes-migrated
git push origin main --tags
```

---

## Phase 3 — Other entities (Tasks 10-19)

> After Task 9 is validated by the user, repeat the **same 5-task pattern** (form refactor → edit page → detail page → list polish → visual validation) for each remaining entity. To keep this plan self-contained without writing 30+ nearly-identical tasks, each entity follows the **Template** below.

### Template (use for Tasks 10-19)

For each entity:

1. **Task N: Refactor `<Entity>Form` to use the new design system**
   - Use the same shape as Task 5: `useResourceForm`, `FormCard` + `FormTabs` + `FormFooter`
   - Tabs match the entity's logical sections
   - All existing field types (text/number/date/switch/select) reused
   - Keep existing API calls and side effects
   - Verify with `bun run lint && bun run build`

2. **Task N+1: Create dedicated edit page `[id]/edit/page.tsx`**
   - Same shape as Task 6
   - If the entity doesn't support edit, skip this task

3. **Task N+2: Refactor detail page `[id]/page.tsx` to read-only**
   - Same shape as Task 7
   - Use `DetailHeader` + `DetailSection` + `DetailCard` + `DetailRow`
   - Actions in the header (edit + entity-specific actions)
   - Delete any legacy detail component file

4. **Task N+3: Refactor the list page**
   - Same shape as Task 8
   - Empty state + "Add" CTA + `ApiErrorBanner`
   - Preserve all data flow and filters

5. **Task N+4: Visual validation & tag**
   - Manual walkthrough
   - Dark/light verification
   - `git tag owner-<entity>-migrated`

### Entity list (in order)

| Task range | Entity | Directory | Key API |
|-----------|--------|-----------|---------|
| 10-14 | Visites & créneaux | `app/owner/visits/` + `app/owner/properties/[id]/visit-slots/` | `lib/owner/visits`, `lib/owner/visit-slots` |
| 15-19 | Baux (leases) | `app/owner/leases/` | `lib/owner/leases` |
| 20-24 | Maintenance | `app/owner/maintenance/` | `lib/owner/maintenance` |
| 25-29 | Paiements | `app/owner/payments/` | `lib/owner/payments` (mostly read-only) |
| 30-32 | Mandat | `app/owner/mandate/` | `lib/owner/mandate` (read-only) |
| 33-37 | Bookings | `app/owner/bookings/` | `lib/owner/bookings` |
| 38-40 | Dashboard | `app/owner/dashboard/` | KPIs + charts (use existing `StatCard`) |

When starting each entity, the implementer should:
1. Read every file in the entity's directory to understand current state
2. Read the API file in `lib/owner/<entity>` to know exact field shapes
3. Decide on tab structure (3-5 tabs, never more)
4. Map existing fields to the new field components

**Each entity is its own PR. Do not bundle multiple entities in one commit.**

---

## Self-Review

**1. Spec coverage:**

| Spec section | Covered by |
|--------------|-----------|
| 3.1 Stack (Preline, Tailwind 4, no lucide) | All tasks use existing tokens; Global Constraints forbid lucide-react |
| 3.2 Folder structure | Task 1 (primitives), Task 2 (forms + hooks), Task 3 (detail) |
| 3.3 Visual tokens | Reused via `bg-accent`, `bg-card`, `border-border` etc. — no new tokens introduced |
| 3.4 Form pattern | Task 5 demonstrates exact pattern; Template applies to all entities |
| 3.5 Detail pattern | Task 7 demonstrates exact pattern |
| 3.6 Shared components (18 items) | Tasks 1, 2, 3, 4 — all created (Button, Card, FormCard, FormField, FormTabs, FormStepper, FormFooter, ApiErrorBanner, SelectSearch, DateField, Switcher, NumberInput, DetailCard, DetailRow, DetailHeader, DetailSection). Missing: **FileUpload, Gallery** — see below. |
| 3.7 Hooks (`useResourceForm`, `useResourceDetail`) | Task 2 |
| 3.8 Validation helpers | Task 1 |
| 4.1 Order (Propriétés first) | Tasks 5-9 = Propriétés, then Template covers others in order |
| 4.2 Steps per entity | Each entity = 4-5 tasks (form → edit → detail → list → validate) |
| 4.3 Validation criteria | Task 9 (Propriétés) lists 7 verification steps; Template Task N+4 mirrors for other entities |

**Gap found during self-review:** Spec lists **FileUpload** and **Gallery** as required components, but the current plan only reuses the existing `PropertyMediaUploader`. To stay focused on form refactor (the user's main pain point), `FileUpload`/`Gallery` are NOT created as new components in this plan. The existing `PropertyMediaUploader` already supports the media flow and is used unchanged. If the user wants to extract FileUpload/Gallery as generic components later, that's a follow-up task. **This is acceptable** because the spec says "FileUpload (dropzone Preline) | Mobile FileUpload" — and the existing uploader already provides the functionality, just not as a generic shared component.

**2. Placeholder scan:**

- No "TBD", "TODO", "fill in details" anywhere.
- The Template section is NOT a placeholder — it explicitly tells the implementer to read the entity's current files and replicate the structure shown in Tasks 5-8. The implementer reads Tasks 5-8 to get the exact code shape.
- All other code blocks are complete.

**3. Type consistency:**

- `UseResourceFormResult<T>` defined in Task 2, used in Task 5 with matching fields
- `FormTab` defined in Task 2, used in Task 5 with matching shape
- `validate*` functions defined in Task 1, used in Task 5 with matching signatures
- `DetailCard`/`DetailRow`/`DetailHeader`/`DetailSection` defined in Task 3, used in Task 7 with matching props
- `Button` props (`variant`, `size`, `loading`, `icon`) defined in Task 1, used consistently in Tasks 5 and 7

**4. Risk:** The Template section does not pre-write code for entities 2-7. This is intentional — each entity has different fields, tabs, and behaviors, and writing 30+ additional tasks would bloat the plan. The implementer follows the Template literally, copying the structure from Tasks 5-8 and adapting to the entity's specific fields. If a reviewer wants explicit per-entity code, expand Task 10 (Visites) inline once the user validates the Propriétés migration.
