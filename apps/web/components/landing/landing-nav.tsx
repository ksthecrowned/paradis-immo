'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS } from '@/lib/dash-icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LandingLogo } from './landing-logo';

const LINKS = [
  { label: 'Biens', href: '#properties' },
  { label: 'Application', href: '#app' },
  { label: 'Gestion', href: '#manage' },
] as const;

export function LandingNav(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = (): void => {
      const y = window.scrollY;
      setScrolled(y > 12);
      setOnHero(y < window.innerHeight * 0.72);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const headerClass = [
    'landing-header fixed top-0 z-50 w-full transition-[background-color,box-shadow,border-color] duration-200',
    onHero ? 'landing-header-on-hero' : '',
    scrolled || open ? 'landing-header-scrolled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClass}>
      <div className="landing-container flex h-[68px] items-center justify-between gap-4 md:h-[76px]">
        <LandingLogo className="landing-logo-mark" />

        <nav
          className="hidden items-center gap-9 lg:flex"
          aria-label="Navigation principale"
        >
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="landing-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="landing-btn-icon"
            aria-label={
              theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'
            }
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            onClick={toggleTheme}
          >
            <DashIcon
              icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
              width={18}
              height={18}
            />
          </button>

          <Link
            href="/login"
            className="landing-btn landing-btn-outline hidden px-5 py-2.5 sm:inline-flex"
          >
            Espace gestionnaire
          </Link>

          <button
            type="button"
            className="landing-btn-icon lg:hidden"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <DashIcon
              icon={
                open ? 'solar:close-circle-linear' : 'solar:hamburger-menu-linear'
              }
              className="size-5"
            />
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[var(--lp-border)] bg-[var(--lp-bg)] px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-[var(--lp-radius-sm)] px-3 py-3 text-[15px] font-medium text-[var(--lp-ink)] hover:bg-[var(--lp-primary-muted)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="landing-btn landing-btn-primary mt-3 w-full"
              onClick={() => setOpen(false)}
            >
              Espace gestionnaire
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
