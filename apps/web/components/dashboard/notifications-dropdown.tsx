'use client';

import { DashIcon } from '@/components/dash-icon';
import { Button } from '@/components/primitives/Button';
import { ApiError } from '@/lib/api';
import { DASH_ICONS } from '@/lib/dash-icons';
import {
  groupNotificationsByDay,
  listMyNotifications,
  mapNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsPath,
  type NotificationView,
} from '@/lib/notifications';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardRole } from './sidebar-nav';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const POPOVER_WIDTH = 338;
const POPOVER_GAP = 8;
const PREVIEW_LIMIT = 8;

interface PopoverPosition {
  top: number;
  left: number;
}

function computePosition(triggerRect: DOMRect): PopoverPosition {
  const margin = 8;
  const top = Math.min(
    triggerRect.bottom + POPOVER_GAP,
    window.innerHeight - margin,
  );
  const left = Math.min(
    window.innerWidth - POPOVER_WIDTH - margin,
    Math.max(margin, triggerRect.right - POPOVER_WIDTH),
  );
  return { top, left };
}

export function NotificationsDropdown({
  role,
}: {
  role: DashboardRole;
}): React.JSX.Element {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const pageHref = notificationsPath(role);

  const unreadCount = items.filter((item) => !item.read).length;
  const preview = items.slice(0, PREVIEW_LIMIT);
  const groups = groupNotificationsByDay(preview);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listMyNotifications();
      setItems(rows.map((row) => mapNotification(row, role)));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les notifications.',
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    function onPush(): void {
      void load();
    }
    window.addEventListener('paradis:push', onPush);
    return () => window.removeEventListener('paradis:push', onPush);
  }, [load]);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPosition(computePosition(trigger.getBoundingClientRect()));
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    function handleReposition(): void {
      const trigger = triggerRef.current;
      if (!trigger) return;
      setPosition(computePosition(trigger.getBoundingClientRect()));
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  async function handleMarkAsRead(item: NotificationView): Promise<void> {
    if (!item.read) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, read: true } : row,
        ),
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        // Optimistic UI; next load resyncs.
      }
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  async function handleMarkAllAsRead(): Promise<void> {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setItems((current) =>
        current.map((item) => ({ ...item, read: true })),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de tout marquer comme lu.',
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="relative inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void load();
        }}
      >
        <DashIcon icon={DASH_ICONS.bell} width={22} height={22} />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute inset-e-2.5 top-2.5 z-1 inline-flex size-2.5 rounded-full bg-danger shadow-sm ring-2 ring-topbar"
          >
            <span className="absolute inset-0 z-[-1] animate-ping rounded-full bg-danger opacity-75" />
          </span>
        ) : null}
      </button>

      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Notifications"
              className="fixed z-50 overflow-hidden rounded-xl border border-border bg-table p-0 shadow-2xl"
              style={{
                top: position.top,
                left: position.left,
                width: POPOVER_WIDTH,
              }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 pt-5 pb-4">
                <h4 className="text-base leading-6 font-semibold text-foreground">
                  Notifications
                </h4>
                <Link
                  href={pageHref}
                  onClick={() => setOpen(false)}
                  className="p-1 text-muted transition-colors hover:text-foreground"
                  aria-label="Voir toutes les notifications"
                  title="Voir toutes"
                >
                  <DashIcon icon={DASH_ICONS.settings} width={16} height={16} />
                </Link>
              </div>

              <div className="max-h-100 overflow-y-auto">
                {loading && items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Chargement…
                  </p>
                ) : null}
                {error ? (
                  <p className="px-5 py-4 text-sm text-danger">{error}</p>
                ) : null}
                {!loading && !error && items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    Aucune notification pour le moment.
                  </p>
                ) : null}
                {groups.map((group) => (
                  <section key={group.title}>
                    <div className="border-y border-border bg-search px-5 py-2">
                      <p className="text-xs leading-4 text-muted uppercase">
                        {group.title}
                      </p>
                    </div>
                    <ul className="px-3 py-2">
                      {group.items.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            className="group flex w-full cursor-pointer gap-3.5 rounded-lg px-3 py-3 text-start transition-colors duration-300 hover:bg-card-hover"
                            onClick={() => void handleMarkAsRead(notification)}
                          >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-search text-muted transition-all duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
                              <DashIcon
                                icon={notification.icon}
                                width={20}
                                height={20}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm leading-5 font-semibold text-foreground">
                                  {notification.title}
                                </p>
                                {!notification.read ? (
                                  <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                                ) : null}
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted">
                                {notification.body}
                              </p>
                              <p className="mt-2 text-xs leading-4 text-placeholder">
                                {notification.time}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border px-5 py-4">
                <button
                  type="button"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={unreadCount === 0}
                  className="text-xs font-medium text-muted underline transition-colors hover:text-foreground disabled:no-underline disabled:opacity-50"
                >
                  Tout marquer comme lu
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  className="py-1.5"
                  onClick={() => {
                    setOpen(false);
                    router.push(pageHref);
                  }}
                >
                  Tout voir
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
