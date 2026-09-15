import { DashIcon } from '@/components/dash-icon';
import Link from 'next/link';
import { LandingLogo } from './landing-logo';

type FooterLink = { label: string; href: string };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'SELL A HOME',
    links: [
      { label: 'Request an offer', href: '/#hero' },
      { label: 'Pricing', href: '/#hero' },
      { label: 'Reviews', href: '/#hero' },
      { label: 'Stories', href: '/#hero' },
    ],
  },
  {
    title: 'BUY, RENT AND SELL',
    links: [
      { label: 'Buy and sell properties', href: '/#hero' },
      { label: 'Rent home', href: '/#hero' },
      { label: 'Builder trade-up', href: '/#hero' },
    ],
  },
  {
    title: 'ABOUT',
    links: [
      { label: 'Company', href: '/#hero' },
      { label: 'How it works', href: '/#hero' },
      { label: 'Contact', href: '/#hero' },
      { label: 'Investors', href: '/#hero' },
    ],
  },
  {
    title: 'BUY A HOME',
    links: [
      { label: 'Buy', href: '/#hero' },
      { label: 'Finance', href: '/#hero' },
    ],
  },
  {
    title: 'TERMS & PRIVACY',
    links: [
      { label: 'Trust & Safety', href: '/#hero' },
      { label: 'Terms of Service', href: '/#hero' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
  {
    title: 'RESOURCES',
    links: [
      { label: 'Blog', href: '/#hero' },
      { label: 'Guides', href: '/#hero' },
      { label: 'FAQ', href: '/#hero' },
      { label: 'Help Center', href: '/#hero' },
    ],
  },
];

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
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link
                        href={link.href}
                        className="text-[15px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-primary)]"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[15px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-primary)]"
                      >
                        {link.label}
                      </a>
                    )}
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
                href="/#hero"
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
