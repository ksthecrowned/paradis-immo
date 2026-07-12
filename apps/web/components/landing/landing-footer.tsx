import { DashIcon } from '@/components/dash-icon';
import { LandingLogo } from './landing-logo';

const COLUMNS = [
  {
    title: 'SELL A HOME',
    links: ['Request an offer', 'Pricing', 'Reviews', 'Stories'],
  },
  {
    title: 'BUY, RENT AND SELL',
    links: ['Buy and sell properties', 'Rent home', 'Builder trade-up'],
  },
  {
    title: 'ABOUT',
    links: ['Company', 'How it works', 'Contact', 'Investors'],
  },
  {
    title: 'BUY A HOME',
    links: ['Buy', 'Finance'],
  },
  {
    title: 'TERMS & PRIVACY',
    links: ['Trust & Safety', 'Terms of Service', 'Privacy Policy'],
  },
  {
    title: 'RESOURCES',
    links: ['Blog', 'Guides', 'FAQ', 'Help Center'],
  },
] as const;

const SOCIAL = [
  'solar:facebook-bold',
  'solar:instagram-bold',
  'solar:twitter-bold',
  'solar:linkedin-bold',
] as const;

export function LandingFooter(): React.JSX.Element {
  return (
    <footer className="bg-[var(--lp-surface)]">
      <div className="landing-container flex flex-col gap-12 py-16 md:flex-row md:items-start md:justify-between md:gap-16">
        <LandingLogo />
        <div className="grid flex-1 grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-bold tracking-wide text-[var(--lp-ink)]">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#hero"
                      className="text-[15px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-primary)]"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--lp-border)]">
        <div className="landing-container flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
          <p className="text-sm text-[var(--lp-muted)]">
            ©{new Date().getFullYear()} Paradis Immo. All rights reserved
          </p>
          <div className="flex items-center gap-5">
            {SOCIAL.map((icon) => (
              <a
                key={icon}
                href="#hero"
                className="text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-primary)]"
                aria-label="Social link"
              >
                <DashIcon icon={icon} className="size-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
