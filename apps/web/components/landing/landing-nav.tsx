'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS } from '@/lib/dash-icons';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LandingLogo } from './landing-logo';

const LEFT_LINKS = [
  { label: 'Home', href: '#hero' },
  { label: 'Rent', href: '#properties' },
  { label: 'Buy', href: '#properties' },
] as const;

const RIGHT_LINKS = [
  { label: 'Service', href: '#benefits' },
  { label: 'About Us', href: '#advantages' },
] as const;

const MOBILE_LINKS = [...LEFT_LINKS, ...RIGHT_LINKS] as const;

export function LandingNav(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled(window.scrollY > 8);
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

  return (
    <header
      className={`landing-header sticky top-0 z-50 w-full transition-[background-color,box-shadow,border-color] duration-200 ${
        scrolled || open ? 'landing-header-scrolled' : ''
      }`}
    >
      <div className="landing-container relative grid h-[72px] grid-cols-[1fr_auto_1fr] items-center gap-3 md:h-20">
        {/* Left */}
        <nav
          className="landing-nav-left hidden items-center gap-8 lg:flex"
          aria-label="Navigation gauche"
        >
          {LEFT_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="landing-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center justify-self-start rounded-full border border-[var(--lp-border)] bg-[var(--lp-surface)] text-[var(--lp-ink)] lg:hidden"
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

        {/* Center logo */}
        <div className="justify-self-center">
          <LandingLogo
            className="landing-logo-mark"
            textClassName="!text-[var(--lp-primary)]"
          />
        </div>

        {/* Right */}
        <div className="hidden items-center justify-end gap-6 lg:flex">
          <nav
            className="flex items-center gap-8"
            aria-label="Navigation droite"
          >
            {RIGHT_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="landing-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
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
          <Link href="/login" className="landing-btn landing-btn-outline">
            Contact
          </Link>
        </div>

        <div className="flex items-center justify-end gap-2 lg:hidden">
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
        </div>
      </div>

      {open ? (
        <div className="border-t border-[var(--lp-border)] bg-[var(--lp-bg)] px-5 py-5 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {MOBILE_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-[var(--lp-radius-sm)] px-3 py-3 text-[15px] font-medium text-[var(--lp-ink)] hover:bg-[var(--lp-primary-muted)]"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              className="landing-btn landing-btn-outline mt-3 w-full"
              onClick={() => setOpen(false)}
            >
              Contact
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
