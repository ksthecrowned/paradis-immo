import { Button } from '@/components/primitives';

export type FormFooterProps = {
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
