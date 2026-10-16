'use client';

import { ApiErrorBanner } from '@/components/forms';
import { Switcher } from '@/components/forms/Switcher';
import { Button } from '@/components/primitives/Button';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  getMe,
  updateMe,
  type NotificationChannelPreference,
  type PublicUser,
} from '@/lib/me';
import {
  isWebPushConfigured,
  registerWebPushWithApi,
} from '@/lib/web-push';
import { useCallback, useEffect, useState } from 'react';

const CHANNEL_OPTIONS: {
  id: NotificationChannelPreference;
  label: string;
  description: string;
}[] = [
  {
    id: 'PUSH',
    label: 'Notifications push',
    description: 'Alertes navigateur / appareil (Firebase).',
  },
  {
    id: 'WHATSAPP',
    label: 'WhatsApp',
    description: 'Messages opérationnels sur votre numéro.',
  },
];

export function ProfileNotifications(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [channel, setChannel] =
    useState<NotificationChannelPreference>('WHATSAPP');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pushConfigured = isWebPushConfigured();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
      setChannel(
        me.notificationChannel === 'SMS' ? 'WHATSAPP' : me.notificationChannel,
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les préférences.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setNotice(null);
    try {
      if (channel === 'PUSH' && pushConfigured) {
        const result = await registerWebPushWithApi();
        if (!result.ok && result.reason === 'PERMISSION_DENIED') {
          setError(
            'Autorisation navigateur refusée — activez les notifications pour ce site.',
          );
          setSaving(false);
          return;
        }
      } else {
        await updateMe({ notificationChannel: channel });
      }
      await load();
      setNotice('Préférences de notification enregistrées.');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’enregistrer les préférences.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold leading-7 text-foreground">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-muted">
          Choisissez le canal principal pour les alertes métier.
        </p>
      </div>

      <ApiErrorBanner message={error} />
      {notice ? (
        <p
          className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <div className="divide-y divide-border">
        {CHANNEL_OPTIONS.map((option) => {
          const checked = channel === option.id;
          return (
            <div
              key={option.id}
              className="flex items-center justify-between gap-4 py-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {option.label}
                </p>
                <p className="mt-1 text-xs text-muted">{option.description}</p>
                {option.id === 'PUSH' && !pushConfigured ? (
                  <p className="mt-1 text-xs text-warning">
                    Firebase web non configuré sur cet environnement.
                  </p>
                ) : null}
              </div>
              <Switcher
                checked={checked}
                label={option.label}
                className="shrink-0 [&>span:last-child]:sr-only"
                onChange={(next) => {
                  if (next) setChannel(option.id);
                  else if (channel === option.id) {
                    setChannel(option.id === 'PUSH' ? 'WHATSAPP' : 'PUSH');
                  }
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          size="sm"
          loading={saving}
          disabled={channel === user?.notificationChannel && channel !== 'PUSH'}
          onClick={() => void handleSave()}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
