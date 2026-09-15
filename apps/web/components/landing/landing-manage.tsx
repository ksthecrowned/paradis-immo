import Link from 'next/link';
import { DashIcon } from '@/components/dash-icon';

const OUTCOMES = [
  {
    icon: 'solar:home-2-linear',
    title: 'Vos biens, visibles',
    body: 'Publiez location, courte durée ou vente — avec photos, tarifs et disponibilité.',
  },
  {
    icon: 'solar:calendar-mark-linear',
    title: 'Le quotidien, suivi',
    body: 'Visites, réservations, baux et locataires dans un même fil d’activité.',
  },
  {
    icon: 'solar:graph-up-linear',
    title: 'Les ventes, structurées',
    body: 'Chaque dossier avancé jusqu’à la conclusion, sans perdre le fil.',
  },
] as const;

export function LandingManage(): React.JSX.Element {
  return (
    <section
      id="manage"
      className="relative overflow-hidden bg-(--lp-bg-soft) py-20 md:py-28"
      aria-labelledby="manage-heading"
    >
      <div className="landing-container relative">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="lp-eyebrow">Gestion</p>
            <h2
              id="manage-heading"
              className="mt-3 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
            >
              La gestion, sans le chaos.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-(--lp-muted)">
              Un espace web pensé pour propriétaires et agents — pas un second
              mobile.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/login" className="landing-btn landing-btn-primary">
              Accéder à l&apos;espace
            </Link>
            <Link href="/register" className="landing-btn landing-btn-outline">
              Créer mon espace
            </Link>
          </div>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {OUTCOMES.map((item, i) => (
            <li
              key={item.title}
              className="rounded-(--lp-radius-xl) border border-(--lp-border) bg-(--lp-surface) p-7 shadow-(--lp-shadow-card)"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-(--lp-radius-md) bg-(--lp-primary-muted)">
                  <DashIcon
                    icon={item.icon}
                    className="size-5 text-(--lp-ink)"
                  />
                </span>
                <span className="font-mono text-sm text-(--lp-primary)">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-(--lp-ink)">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--lp-muted)">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
