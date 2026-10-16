import { DashIcon } from '@/components/dash-icon';

const TONE_STYLES = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-muted/10 text-muted',
  accent: 'bg-accent/10 text-accent',
} as const;

const TONE_ICONS = {
  success: 'solar:check-circle-linear',
  warning: 'solar:clock-circle-linear',
  danger: 'solar:close-circle-linear',
  neutral: 'solar:info-circle-linear',
  accent: 'solar:star-linear',
} as const;

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'accent';
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-sm font-normal ${TONE_STYLES[tone]}`}
    >
      <DashIcon icon={TONE_ICONS[tone]} className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}
