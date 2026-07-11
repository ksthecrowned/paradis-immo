import Image from 'next/image';
import Link from 'next/link';

const BENEFITS = [
  {
    icon: '/landing/benefit-1.svg',
    title: 'Property Insurance',
    description:
      'We offer our customer property protection of liability coverage and insurance for their better life.',
  },
  {
    icon: '/landing/benefit-2.svg',
    title: 'Best Price',
    description:
      'Not sure what you should be charging for your property? No need to worry, let us do the numbers for you.',
  },
  {
    icon: '/landing/benefit-3.svg',
    title: 'Lowest Commission',
    description:
      'You no longer have to negotiate commissions and haggle with other agents it only cost 2%!',
  },
  {
    icon: '/landing/benefit-4.svg',
    title: 'Overall Control',
    description:
      'Get a virtual tour, and schedule visits before you rent or buy any properties. You get overall control.',
  },
] as const;

export function LandingBenefits(): React.JSX.Element {
  return (
    <section id="benefits" className="bg-white py-16 md:py-24">
      <div className="landing-container flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
        <div className="relative w-full max-w-[360px] overflow-hidden rounded-[var(--lp-radius-lg)] border border-[var(--lp-border)] bg-[var(--lp-primary-muted)] p-7 pb-44">
          <h2 className="text-[32px] font-bold leading-tight text-[var(--lp-navy)] md:text-[36px]">
            The new way to find your new home
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-muted)]">
            Find your dream place to live in with more than 10k properties
            listed.
          </p>
          <Link
            href="/login"
            className="landing-btn landing-btn-navy mt-8"
          >
            Browse Properties
          </Link>
          <Image
            src="/landing/home-illustration.svg"
            alt=""
            width={220}
            height={180}
            className="pointer-events-none absolute bottom-0 end-0 h-auto w-[200px]"
          />
        </div>

        <div className="grid flex-1 gap-x-10 gap-y-12 sm:grid-cols-2">
          {BENEFITS.map((item) => (
            <div key={item.title} className="flex gap-4 sm:max-w-[280px] sm:flex-col sm:gap-0">
              <Image
                src={item.icon}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 sm:mb-5"
              />
              <div>
                <h3 className="text-lg font-semibold text-[var(--lp-ink)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
