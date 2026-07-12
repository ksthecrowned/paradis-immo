const STEPS = [
  {
    step: '01',
    title: 'Créez votre compte',
    description:
      'Inscription mobile par OTP WhatsApp. Préférences chercheur (louer, acheter, visiter) en quelques écrans.',
    audience: 'App mobile',
  },
  {
    step: '02',
    title: 'Explorez & visitez',
    description:
      'Filtrez par mode et quartier, réservez une visite, ou démarrez une réservation courte durée / demande d’achat.',
    audience: 'Locataires & acheteurs',
  },
  {
    step: '03',
    title: 'Gérez côté web',
    description:
      'Propriétaires publient leurs biens, agents gèrent le portefeuille sous mandat, admin modère la plateforme.',
    audience: 'Dashboard web',
  },
  {
    step: '04',
    title: 'Payez & suivez',
    description:
      'Mobile Money ou espèces validées. Loyers, reçus, maintenance et alertes restent dans le même parcours.',
    audience: 'Tous les rôles',
  },
] as const;

export function LandingHowItWorks(): React.JSX.Element {
  return (
    <section id="how-it-works" className="bg-[var(--lp-surface)] py-16 md:py-24">
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-bold text-[var(--lp-ink)] md:text-[44px]">
            Comment ça marche
          </h2>
          <p className="mt-4 text-[15px] text-[var(--lp-muted)]">
            Un même backend pour l’app locataire et les espaces web de gestion.
          </p>
        </div>

        <ol className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((item) => (
            <li
              key={item.step}
              className="relative rounded-[var(--lp-radius-lg)] border border-[var(--lp-border)] bg-[var(--lp-bg)] p-6"
            >
              <p className="text-sm font-bold tracking-wide text-[var(--lp-primary)]">
                {item.step}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-[var(--lp-ink)]">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--lp-muted)]">
                {item.description}
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--lp-primary)]">
                {item.audience}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
