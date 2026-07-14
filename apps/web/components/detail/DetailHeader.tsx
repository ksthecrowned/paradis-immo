import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

export type DetailHeaderProps = {
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
