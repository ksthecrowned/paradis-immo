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
