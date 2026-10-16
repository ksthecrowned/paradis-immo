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
  /** Hex color for the icon tile (and sparkline fallback when unset). */
  iconColor?: string;
  href?: string;
  sparkline?: number[];
  sparklineColor?: string;
}

function tint(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  href,
  sparkline,
  sparklineColor,
}: StatCardProps): React.JSX.Element {
  const display =
    value === null || value === undefined ? '—' : String(value);
  const accent = iconColor ?? sparklineColor ?? DASH_CHART_COLORS.purple;
  const lineColor = sparklineColor ?? accent;

  const inner = (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-table">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-base font-medium text-muted">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-active">
            {display}
          </p>
        </div>
        {icon ? (
          <div
            className={
              iconColor || sparklineColor
                ? 'flex size-14 shrink-0 items-center justify-center rounded-md'
                : 'flex size-14 shrink-0 items-center justify-center rounded-md bg-accent-light/25'
            }
            style={
              iconColor || sparklineColor
                ? { backgroundColor: tint(accent, 0.18), color: accent }
                : undefined
            }
          >
            <DashIcon
              icon={icon}
              className={
                iconColor || sparklineColor ? 'text-current' : 'text-accent'
              }
              width={24}
              height={24}
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
        className="block h-full transition-opacity hover:opacity-95 focus:outline-none"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
