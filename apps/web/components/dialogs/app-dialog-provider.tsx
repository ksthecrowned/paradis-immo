'use client';

import { DashIcon } from '@/components/dash-icon';
import {
  registerAppDialogHandler,
  resolveAppDialog,
  type AppDialogRequest,
} from '@/components/dialogs/app-dialog';
import { useCallback, useEffect, useState } from 'react';

export function AppDialogProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [requests, setRequests] = useState<AppDialogRequest[]>([]);

  useEffect(
    () =>
      registerAppDialogHandler((request) =>
        setRequests((current) => [...current, request]),
      ),
    [],
  );

  const finish = useCallback(
    (request: AppDialogRequest, result: boolean | string | null) => {
      setRequests((current) => current.filter(({ id }) => id !== request.id));
      resolveAppDialog(request.id, result);
    },
    [],
  );

  return (
    <>
      {children}
      {requests[0] ? (
        <DialogForm
          key={requests[0].id}
          request={requests[0]}
          onFinish={finish}
        />
      ) : null}
    </>
  );
}

function DialogForm({
  request,
  onFinish,
}: {
  request: AppDialogRequest;
  onFinish: (request: AppDialogRequest, result: boolean | string | null) => void;
}): React.JSX.Element {
  const [value, setValue] = useState(
    request.kind === 'prompt' ? request.defaultValue ?? '' : '',
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const promptRequest = request.kind === 'prompt' ? request : null;
  const isPrompt = promptRequest !== null;
  const isAlert = request.kind === 'alert';

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onFinish(request, isAlert ? true : isPrompt ? null : false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAlert, isPrompt, onFinish, request]);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isPrompt) {
      if (promptRequest?.minLength && value.trim().length < promptRequest.minLength) {
        setValidationError(
          `Saisissez au moins ${promptRequest.minLength} caractères.`,
        );
        return;
      }
      if (promptRequest?.required && !value.trim()) {
        setValidationError('Ce champ est obligatoire.');
        return;
      }
      onFinish(request, value);
    } else {
      onFinish(request, true);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/55 p-4">
      <form
        role={isAlert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`${request.id}-title`}
        aria-describedby={`${request.id}-message`}
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-border bg-table p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <span
            className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${
              request.variant === 'danger'
                ? 'bg-danger/10 text-danger'
                : 'bg-accent/10 text-accent'
            }`}
          >
            <DashIcon
              icon={
                request.variant === 'danger'
                  ? 'solar:danger-triangle-linear'
                  : 'solar:question-circle-linear'
              }
              className="size-5"
            />
          </span>
          <div className="min-w-0">
            <h2
              id={`${request.id}-title`}
              className="text-base font-semibold text-heading"
            >
              {request.title ??
                (isAlert ? 'Information' : isPrompt ? 'Votre réponse' : 'Confirmation')}
            </h2>
            <p
              id={`${request.id}-message`}
              className="mt-1 whitespace-pre-line text-sm font-normal text-muted"
            >
              {request.message}
            </p>
          </div>
        </div>

        {promptRequest ? (
          <div className="mb-5">
            {promptRequest.label ? (
              <label
                htmlFor={`${request.id}-input`}
                className="mb-1.5 block text-sm font-medium text-muted"
              >
                {promptRequest.label}
                {promptRequest.required ? ' *' : ''}
              </label>
            ) : null}
            {promptRequest.multiline ? (
              <textarea
                id={`${request.id}-input`}
                autoFocus
                rows={4}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setValidationError(null);
                }}
                className="block w-full resize-y rounded-lg border border-input-border bg-search px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder={promptRequest.placeholder}
              />
            ) : (
              <input
                id={`${request.id}-input`}
                autoFocus
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setValidationError(null);
                }}
                className="block w-full rounded-lg border border-input-border bg-search px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder={promptRequest.placeholder}
              />
            )}
            {validationError ? (
              <p className="mt-1.5 text-sm text-danger" role="alert">
                {validationError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          {!isAlert ? (
            <button
              type="button"
              onClick={() => onFinish(request, isPrompt ? null : false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-active transition-colors hover:bg-card-hover"
            >
              {request.cancelLabel ?? 'Annuler'}
            </button>
          ) : null}
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              request.variant === 'danger'
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-accent text-on-accent hover:bg-accent/90'
            }`}
          >
            {request.confirmLabel ?? (isAlert ? 'Fermer' : 'Confirmer')}
          </button>
        </div>
      </form>
    </div>
  );
}
