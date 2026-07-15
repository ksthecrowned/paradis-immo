'use client';

import { DashIcon } from '@/components/dash-icon';
import type { DashIconName } from '@/lib/dash-icons';
import { DASH_CHART_COLORS } from '@/lib/dash-icons';
import Link from 'next/link';
import { StatCardSparkline } from './stat-card-sparkline';

export interface StatCardProps {
  label: string;
  value: number | string | null;
  icon?: DashIconName;
  href?: string;
  sparkline?: number[];
  sparklineColor?: string;
}

export function StatCard({
  label,
  value,
  icon,
  href,
  sparkline,
  sparklineColor,
}: StatCardProps): React.JSX.Element {
  const display =
    value === null || value === undefined ? '—' : String(value);
  const lineColor = sparklineColor ?? DASH_CHART_COLORS.purple;

  const inner = (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-base font-medium text-muted">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-foreground">
            {display}
          </p>
        </div>
        {icon ? (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-accent-light/25">
            <DashIcon
              icon={icon}
              className="text-accent"
              width={24} height={24}
            />
          </div>
        ) : null}
      </div>
      {sparkline && sparkline.length > 0 ? (
        <div className="mt-auto pb-1">
          <StatCardSparkline data={sparkline} color={lineColor} />
        </div>
      ) : (
        <div className="h-14" />
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
