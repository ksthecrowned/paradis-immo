'use client';

import { DashIcon } from '@/components/dash-icon';
import {
  DashboardPageHeader,
  type DashboardRole,
} from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import { Button } from '@/components/primitives/Button';
import { ApiError } from '@/lib/api';
import {
  groupNotificationsByDay,
  listMyNotifications,
  mapNotification,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationView,
} from '@/lib/notifications';
import { useRequireSession } from '@/hooks/use-require-session';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Filter = 'all' | 'unread';

export function NotificationsCenter({
  role,
}: {
  role: DashboardRole;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);

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
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );

  const visible = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.read);
    return items;
  }, [filter, items]);

  const groups = useMemo(() => groupNotificationsByDay(visible), [visible]);

  async function handleMarkAllRead(): Promise<void> {
    if (unreadCount === 0) return;
    setMarkingAll(true);
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
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleOpen(item: NotificationView): Promise<void> {
    if (!item.read) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, read: true } : row,
        ),
      );
      try {
        await markNotificationRead(item.id);
      } catch {
        // Keep optimistic UI; next reload will resync.
      }
    }
  }

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Toutes vos notifications sont à jour.'
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={markingAll}
            disabled={unreadCount === 0}
            onClick={() => void handleMarkAllRead()}
          >
            Tout marquer comme lu
          </Button>
        }
      />

      <ApiErrorBanner message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`Toutes (${items.length})`}
        />
        <FilterChip
          active={filter === 'unread'}
          onClick={() => setFilter('unread')}
          label={`Non lues (${unreadCount})`}
        />
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted">
          Chargement des notifications…
        </div>
      ) : null}

      {!loading && visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <DashIcon
            icon="solar:bell-linear"
            width={28}
            height={28}
            className="mx-auto text-muted"
          />
          <p className="mt-3 text-sm font-medium text-foreground">
            {filter === 'unread'
              ? 'Aucune notification non lue'
              : 'Aucune notification'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Les alertes paiements, visites et maintenance apparaîtront ici.
          </p>
        </div>
      ) : null}

      {!loading && groups.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {groups.map((group) => (
            <section key={group.title}>
              <div className="border-y border-border bg-search px-5 py-2 first:border-t-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {group.title}
                </p>
              </div>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} className="border-b border-border last:border-b-0">
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => void handleOpen(item)}
                        className="group flex w-full gap-3.5 px-5 py-4 text-start transition-colors hover:bg-card-hover"
                      >
                        <NotificationRow item={item} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleOpen(item)}
                        className="group flex w-full gap-3.5 px-5 py-4 text-start transition-colors hover:bg-card-hover"
                      >
                        <NotificationRow item={item} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3 py-1.5 text-sm transition-colors ' +
        (active
          ? 'bg-accent text-on-accent'
          : 'bg-card text-muted ring-1 ring-border hover:bg-card-hover hover:text-foreground')
      }
    >
      {label}
    </button>
  );
}

function NotificationRow({
  item,
}: {
  item: NotificationView;
}): React.JSX.Element {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-search text-muted transition-all group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
        <DashIcon icon={item.icon} width={20} height={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-placeholder">{item.time}</span>
            {!item.read ? (
              <span className="size-1.5 rounded-full bg-accent" aria-label="Non lue" />
            ) : null}
          </div>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{item.body}</p>
      </div>
    </>
  );
}
