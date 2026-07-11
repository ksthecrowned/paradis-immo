'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DashIcon } from '@/components/dash-icon';
import { LandingLogo } from './landing-logo';

const NAV_LINKS = [
  { label: 'Rent', href: '#properties' },
  { label: 'Buy', href: '#properties' },
  { label: 'Sell', href: '#advantages' },
  { label: 'Manage Property', href: '#benefits', hasMenu: true },
  { label: 'Resources', href: '#cta', hasMenu: true },
] as const;

export function LandingNav(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-30 w-full bg-[var(--lp-bg-hero)]">
      <div className="landing-container flex items-center justify-between gap-6 py-6 md:py-8">
        <div className="flex min-w-0 items-center gap-10 lg:gap-16">
          <LandingLogo />
          <nav
            className="hidden items-center gap-10 lg:flex"
            aria-label="Principal"
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="inline-flex items-center gap-1 text-[15px] font-medium text-[var(--lp-ink)] transition-colors hover:text-[var(--lp-primary)]"
              >
                {link.label}
                {'hasMenu' in link && link.hasMenu ? (
                  <DashIcon
                    icon="solar:alt-arrow-down-linear"
                    className="size-4 text-[var(--lp-muted)]"
                  />
                ) : null}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="landing-btn landing-btn-ghost">
            Login
          </Link>
          <Link href="/login" className="landing-btn landing-btn-primary">
            Sign up
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-[var(--lp-radius-sm)] border border-[var(--lp-border)] bg-white text-[var(--lp-ink)] md:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <DashIcon
            icon={
              open
                ? 'solar:close-circle-linear'
                : 'solar:hamburger-menu-linear'
            }
            className="size-5"
          />
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--lp-border)] bg-white px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-3" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[var(--lp-ink)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/login" className="landing-btn landing-btn-ghost">
                Login
              </Link>
              <Link href="/login" className="landing-btn landing-btn-primary">
                Sign up
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
