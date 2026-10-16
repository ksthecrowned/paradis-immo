export type AppDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

export type AppDialogPromptOptions = AppDialogOptions & {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  multiline?: boolean;
};

export type AppDialogRequest =
  | (AppDialogOptions & { id: string; kind: 'confirm' | 'alert' })
  | (AppDialogPromptOptions & { id: string; kind: 'prompt' });

type DialogResult = boolean | string | null;
type DialogHandler = (request: AppDialogRequest) => void;

const pending = new Map<string, (result: DialogResult) => void>();
let dialogHandler: DialogHandler | null = null;
let nextId = 0;

export function registerAppDialogHandler(handler: DialogHandler): () => void {
  dialogHandler = handler;
  return () => {
    if (dialogHandler === handler) dialogHandler = null;
  };
}

function openDialog<T extends DialogResult>(
  request: Omit<AppDialogRequest, 'id'>,
): Promise<T> {
  if (!dialogHandler) {
    return Promise.reject(
      new Error('The application dialog provider is not mounted.'),
    );
  }

  const id = `app-dialog-${++nextId}`;
  const fullRequest = { ...request, id } as AppDialogRequest;
  return new Promise<T>((resolve) => {
    pending.set(id, (result) => resolve(result as T));
    dialogHandler?.(fullRequest);
  });
}

export function resolveAppDialog(
  id: string,
  result: DialogResult,
): void {
  const resolve = pending.get(id);
  if (!resolve) return;
  pending.delete(id);
  resolve(result);
}

export const appDialog = {
  confirm(options: AppDialogOptions | string): Promise<boolean> {
    const normalized =
      typeof options === 'string' ? { message: options } : options;
    return openDialog<boolean>({ ...normalized, kind: 'confirm' });
  },
  prompt(options: AppDialogPromptOptions | string, defaultValue = ''):
    Promise<string | null> {
    const normalized =
      typeof options === 'string'
        ? { message: options, defaultValue }
        : options;
    return openDialog<string | null>({ ...normalized, kind: 'prompt' });
  },
  alert(options: AppDialogOptions | string): Promise<void> {
    const normalized =
      typeof options === 'string' ? { message: options } : options;
    return openDialog<boolean>({ ...normalized, kind: 'alert' }).then(
      () => undefined,
    );
  },
};
