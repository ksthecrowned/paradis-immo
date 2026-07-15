import { Button } from '@/components/primitives/Button';
import { DashIcon } from '@/components/dash-icon';
import Link from 'next/link';

export interface PageHeaderAction {
  /** Mark as the primary action — visually highlighted with accent color. */
  primary?: boolean;
  /** Secondary style if not primary. */
  variant?: 'primary' | 'secondary';
  /** Optional icon (Iconify name, e.g. "mdi:plus"). */
  icon?: string;
  label: string;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  ariaLabel?: string;
  loading?: boolean;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Backwards-compat: ReactNode list of action buttons/links. */
  actions?: React.ReactNode;
  /** New: typed list of actions, rendered with the shared Button. */
  items?: PageHeaderAction[];
}

function renderAction(item: PageHeaderAction, index: number): React.JSX.Element {
  const variant = item.variant ?? (item.primary ? 'primary' : 'secondary');

  // Use a <Link> for href so navigation stays client-side; the Button
  // element handles the rest of the styling.
  if (item.href) {
    return (
      <LinkButton
        key={`${item.label}-${index}`}
        href={item.href}
        variant={variant}
        icon={item.icon}
        disabled={item.disabled}
        ariaLabel={item.ariaLabel ?? item.label}
      >
        {item.label}
      </LinkButton>
    );
  }

  return (
    <Button
      key={`${item.label}-${index}`}
      variant={variant}
      icon={item.icon}
      type={item.type}
      disabled={item.disabled}
      loading={item.loading}
      onClick={item.onClick}
      aria-label={item.ariaLabel ?? item.label}
    >
      {item.label}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  items,
}: PageHeaderProps): React.JSX.Element {
  const hasTypedItems = Array.isArray(items) && items.length > 0;
  const hasLegacyActions = !hasTypedItems && actions != null;

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 text-base text-muted">{description}</p>
          ) : null}
        </div>

        {hasTypedItems ? (
          <div className="flex flex-wrap items-center gap-2">
            {items!.map((item, i) => renderAction(item, i))}
          </div>
        ) : null}
      </div>

      {hasLegacyActions ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// LinkButton — renders a Button-styled <Link>. Mirrors the Button surface
// (same classes) so primary/secondary CTAs look identical whether they
// trigger a route or a callback.
interface LinkButtonProps {
  href: string;
  variant: 'primary' | 'secondary';
  icon?: string;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}

function LinkButton({
  href,
  variant,
  icon,
  disabled,
  ariaLabel,
  children,
}: LinkButtonProps): React.JSX.Element {
  const variantClass =
    variant === 'primary'
      ? 'bg-accent text-white hover:bg-accent-light focus:bg-accent-light'
      : 'bg-card text-foreground border border-border hover:bg-card-hover';
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={[
        'inline-flex items-center justify-center rounded-md px-4 py-2.5 text-base font-medium gap-2 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent/40',
        disabled ? 'pointer-events-none opacity-50' : '',
        variantClass,
      ].join(' ')}
    >
      {icon ? (
        <DashIcon icon={icon} width={18} height={18} aria-hidden />
      ) : null}
      {children}
    </Link>
  );
}
