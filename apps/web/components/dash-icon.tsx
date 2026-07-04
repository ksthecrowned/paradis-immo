'use client';

import { Icon } from '@iconify/react';
import type { DashIconName } from '@/lib/dash-icons';

export interface DashIconProps {
  icon: DashIconName;
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function DashIcon({
  icon,
  className,
  width,
  height,
}: DashIconProps): React.JSX.Element {
  return (
    <Icon
      icon={icon}
      className={className}
      width={width}
      height={height}
      aria-hidden
    />
  );
}
