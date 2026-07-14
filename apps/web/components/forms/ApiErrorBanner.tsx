import { Icon } from '@iconify/react';

export type ApiErrorBannerProps = {
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
