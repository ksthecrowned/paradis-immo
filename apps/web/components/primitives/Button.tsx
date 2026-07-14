'use client';

import { Icon } from '@iconify/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-light focus:bg-accent-light disabled:bg-accent/50',
  secondary:
    'bg-card text-foreground border border-border hover:bg-card-hover disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
  ghost:
    'bg-transparent text-foreground hover:bg-card-hover disabled:opacity-50',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-5 py-3 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent/40',
        'disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
      ) : icon ? (
        <Icon icon={icon} className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
}
