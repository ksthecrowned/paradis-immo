import { DashboardPageHeader } from '@/components/dashboard';

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? '';
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? '';

export default function AdminConfigPage(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Configuration" />

      <div className="max-w-xl space-y-6 rounded-lg border border-border bg-card p-5 text-sm">
        <p className="text-muted">
          Liens de téléchargement de l&apos;application mobile affichés sur la
          page d&apos;accueil. Ces valeurs sont définies via les variables
          d&apos;environnement du déploiement web.
        </p>

        <dl className="space-y-4">
          <div>
            <dt className="font-medium text-foreground">App Store (iOS)</dt>
            <dd className="mt-1 break-all font-mono text-xs text-muted">
              {APP_STORE_URL || 'Non configuré (NEXT_PUBLIC_APP_STORE_URL)'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Google Play (Android)</dt>
            <dd className="mt-1 break-all font-mono text-xs text-muted">
              {PLAY_STORE_URL || 'Non configuré (NEXT_PUBLIC_PLAY_STORE_URL)'}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted">
          Pour mettre à jour ces liens, modifiez le fichier{' '}
          <code className="rounded bg-background px-1">.env.local</code> ou les
          secrets de votre plateforme de déploiement, puis redéployez le site.
        </p>
      </div>
    </section>
  );
}
