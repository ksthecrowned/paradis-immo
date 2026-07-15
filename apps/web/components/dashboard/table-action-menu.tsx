'use client';

import { DashIcon } from '@/components/dash-icon';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface TableActionMenuItem {
  /** Optional Iconify name — shown left of the label. */
  icon?: string;
  label: string;
  /** Render as a link to this href. */
  href?: string;
  /** Render as a button calling onSelect. */
  onSelect?: () => void;
  /** Visual variant for destructive actions. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface TableActionMenuProps {
  /** Direct link to open (e.g. detail page). Renders as the leading "eye" button. */
  viewHref?: string;
  viewLabel?: string;
  /** Items shown inside the overflow menu. */
  items: TableActionMenuItem[];
  /** Accessibility label for the "view" button. */
  viewAriaLabel?: string;
}

function MoreIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
}

// SSR-safe guard: portal target is only available in the browser.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface PopoverPosition {
  top: number;
  left: number;
  // Whether the popover should be flipped to open above the trigger
  // when there's not enough room below.
  openAbove: boolean;
  // Width of the popover (matches `w-48` = 12rem = 192px).
  width: number;
}

const POPOVER_WIDTH = 192; // matches Tailwind w-48
const POPOVER_GAP = 8; // mt-2 between trigger and popover

function computePosition(
  triggerRect: DOMRect,
  popoverHeight: number,
): PopoverPosition {
  const margin = 8;
  // Default: open below, aligned to the end (right) of the trigger.
  const desiredTop = triggerRect.bottom + POPOVER_GAP;
  const spaceBelow = window.innerHeight - desiredTop - margin;
  const openAbove = spaceBelow < popoverHeight && triggerRect.top > spaceBelow;
  const top = openAbove
    ? Math.max(margin, triggerRect.top - popoverHeight - POPOVER_GAP)
    : Math.min(desiredTop, window.innerHeight - popoverHeight - margin);

  // Align right edge of popover with right edge of trigger.
  const left = Math.min(
    window.innerWidth - POPOVER_WIDTH - margin,
    Math.max(margin, triggerRect.right - POPOVER_WIDTH),
  );

  return { top, left, openAbove, width: POPOVER_WIDTH };
}

export function TableActionMenu({
  viewHref,
  viewLabel = 'Voir',
  items,
  viewAriaLabel,
}: TableActionMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  // Position the popover via fixed coordinates relative to the viewport.
  // Re-measured on open, scroll, resize, and any scroll inside the table
  // (which lives in an `overflow-auto` container that can swallow events).
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Measure popover after first render; fall back to estimated height.
    const popoverEl = popoverRef.current;
    const popoverHeight = popoverEl
      ? popoverEl.getBoundingClientRect().height
      : Math.min(48 * items.length + 16, 280);
    setPosition(computePosition(rect, popoverHeight));
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;

    const update = (): void => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const popoverEl = popoverRef.current;
      const popoverHeight = popoverEl
        ? popoverEl.getBoundingClientRect().height
        : 0;
      setPosition(computePosition(rect, popoverHeight));
    };

    function handlePointer(event: MouseEvent): void {
      const target = event.target as Node;
      // Click outside trigger and popover => close.
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true); // capture scroll on any ancestor

    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center gap-1"
    >
      {viewHref ? (
        <Link
          href={viewHref}
          aria-label={viewAriaLabel ?? viewLabel}
          title={viewLabel}
          className="group inline-flex size-9 items-center justify-center rounded-lg border border-accent/25 bg-accent-muted text-accent transition-all hover:border-accent/50 hover:bg-accent hover:text-white hover:shadow-sm"
        >
          <DashIcon
            icon="solar:eye-linear"
            width={18}
            height={18}
            className="transition-transform group-hover:scale-110"
          />
        </Link>
      ) : null}

      {items.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Plus d'actions"
          title="Plus d'actions"
          className={
            'group inline-flex size-9 items-center justify-center rounded-lg border transition-all hover:shadow-sm ' +
            (open
              ? 'border-accent/50 bg-accent text-white'
              : 'border-accent/25 bg-accent-muted text-accent hover:border-accent/50 hover:bg-accent hover:text-white')
          }
        >
          <MoreIcon />
        </button>
      ) : null}

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="menu"
              style={
                position
                  ? {
                      position: 'fixed',
                      top: `${position.top}px`,
                      left: `${position.left}px`,
                      width: `${position.width}px`,
                    }
                  : { position: 'fixed', visibility: 'hidden', top: 0, left: 0 }
              }
              className="z-50 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            >
              <div className="space-y-0.5 p-1">
                {items.map((item, index) => {
                  const baseClass =
                    'flex w-full items-center gap-x-2.5 rounded-lg px-3 py-2 text-sm transition-colors';
                  const variantClass = item.destructive
                    ? 'text-danger hover:bg-danger/10'
                    : 'text-foreground hover:bg-accent-muted hover:text-accent';
                  const iconClass = item.destructive
                    ? 'text-danger'
                    : 'text-accent';
                  const disabledClass = item.disabled
                    ? 'pointer-events-none opacity-50'
                    : '';

                  const content = (
                    <>
                      {item.icon ? (
                        <DashIcon
                          icon={item.icon}
                          width={18}
                          height={18}
                          className={`shrink-0 ${iconClass}`}
                        />
                      ) : null}
                      <span className="truncate font-medium">
                        {item.label}
                      </span>
                    </>
                  );

                  if (item.href) {
                    return (
                      <Link
                        key={`${item.label}-${index}`}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className={`${baseClass} ${variantClass} ${disabledClass}`}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={`${item.label}-${index}`}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                      className={`${baseClass} ${variantClass} ${disabledClass}`}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
