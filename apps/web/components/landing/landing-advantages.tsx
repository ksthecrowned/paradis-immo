import { DashIcon } from '@/components/dash-icon';

const CARDS = [
  {
    icon: 'solar:home-2-bold',
    title: 'Virtual home tour',
    description:
      'You can communicate directly with landlords and we provide you with virtual tour before you buy or rent the property.',
    tone: 'muted' as const,
  },
  {
    icon: 'solar:play-circle-bold',
    title: 'Find the best deal',
    description:
      "Browse thousands of properties, save your favorites and set up search alerts so you don't miss the best home deal!",
    tone: 'light' as const,
  },
  {
    icon: 'solar:document-text-bold',
    title: 'Get ready to apply',
    description:
      'Find your dream house? You just need to do a little to no effort and you can start move in to your new dream home!',
    tone: 'primary' as const,
  },
];

const STATS = [
  { value: '7.4%', label: 'Property return rate' },
  { value: '3,856', label: 'Property in sell & rent' },
  { value: '2,540', label: 'Daily completed transactions' },
];

export function LandingAdvantages(): React.JSX.Element {
  return (
    <section id="advantages" className="bg-[var(--lp-navy)] py-16 md:py-24">
      <div className="landing-container">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <h2 className="max-w-lg text-[32px] font-bold leading-tight text-[var(--lp-on-primary)] md:text-[48px]">
            We make it easy for{' '}
            <span className="text-[var(--lp-primary)]">tenants</span> and{' '}
            <span className="text-[var(--lp-primary)]">landlords.</span>
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-[var(--lp-muted)] md:pt-2">
            Whether it&apos;s selling your current home, getting financing, or
            buying a new home, we make it easy and efficient. The best part?
            you&apos;ll save a bunch of money and time with our services.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {CARDS.map((card) => {
            const styles =
              card.tone === 'primary'
                ? 'bg-[var(--lp-primary)] text-[var(--lp-on-primary)]'
                : card.tone === 'muted'
                  ? 'bg-[color-mix(in_srgb,var(--lp-primary)_42%,transparent)] text-[var(--lp-on-primary)]'
                  : 'bg-[var(--lp-surface)] text-[var(--lp-ink)]';
            const iconStyles =
              card.tone === 'light'
                ? 'bg-[var(--lp-primary-soft)] text-[var(--lp-primary)]'
                : card.tone === 'muted'
                  ? 'bg-[var(--lp-navy)] text-[var(--lp-on-primary)]'
                  : 'bg-[var(--lp-on-primary)]/15 text-[var(--lp-on-primary)]';
            const descStyles =
              card.tone === 'light'
                ? 'text-[var(--lp-muted)]'
                : 'text-[var(--lp-on-primary)]/80';

            return (
              <article
                key={card.title}
                className={`flex flex-col gap-4 rounded-[var(--lp-radius-lg)] p-6 md:flex-row md:gap-5 ${styles}`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${iconStyles}`}
                >
                  <DashIcon icon={card.icon} className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{card.title}</h3>
                  <p className={`mt-3 text-[15px] leading-relaxed ${descStyles}`}>
                    {card.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="my-14 h-px bg-[var(--lp-on-primary)]/15" />

        <div className="grid gap-8 text-center sm:grid-cols-3 sm:gap-4">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={
                index > 0
                  ? 'sm:border-s sm:border-[var(--lp-on-primary)]/20'
                  : undefined
              }
            >
              <p className="text-4xl font-bold text-[var(--lp-on-primary)] md:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-[15px] text-[var(--lp-muted)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
