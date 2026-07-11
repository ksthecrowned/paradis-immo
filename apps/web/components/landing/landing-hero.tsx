'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { DashIcon } from '@/components/dash-icon';

const TABS = ['Rent', 'Buy', 'Sell'] as const;

export function LandingHero(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-[var(--lp-bg-hero)] to-white"
    >
      <div className="landing-container relative grid items-start gap-10 pb-16 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:pb-20 lg:pt-8">
        {/* Left column */}
        <div className="relative z-10 flex flex-col lg:max-w-[520px] lg:pt-6">
          <h1 className="text-[36px] font-bold leading-[1.15] tracking-tight text-[var(--lp-ink)] md:text-[48px] lg:text-[56px]">
            Buy, rent, or sell your property easily
          </h1>
          <p className="mt-5 max-w-[380px] text-base leading-relaxed text-[var(--lp-muted)] md:text-lg">
            A great platform to buy, sell, or even rent your properties without
            any commissions.
          </p>

          {/* Search widget */}
          <div className="mt-8 w-full max-w-[540px]">
            <div className="inline-flex overflow-hidden rounded-t-[var(--lp-radius-md)] bg-white shadow-[var(--lp-shadow-search)]">
              {TABS.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`min-w-[96px] px-7 py-3.5 text-[15px] font-semibold transition-colors ${
                    activeTab === index
                      ? 'border-b-2 border-[var(--lp-primary)] text-[var(--lp-primary)]'
                      : 'border-b-2 border-transparent text-[var(--lp-muted)] hover:text-[var(--lp-ink)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div
              className="flex flex-col gap-4 rounded-b-[var(--lp-radius-md)] rounded-tr-[var(--lp-radius-md)] bg-white p-4 shadow-[var(--lp-shadow-search)] sm:flex-row sm:items-center sm:gap-0 sm:px-5 sm:py-4"
            >
              <div className="min-w-0 flex-1 sm:pe-5">
                <p className="landing-input-label">Location</p>
                <p className="landing-input-value mt-1 truncate">
                  Barcelona, Spain
                </p>
              </div>
              <div className="hidden h-10 w-px bg-[var(--lp-border)] sm:block" />
              <div className="min-w-0 flex-1 sm:px-5">
                <p className="landing-input-label">When</p>
                <p className="landing-input-value mt-1 flex items-center gap-2">
                  Select Move-in Date
                  <DashIcon
                    icon="solar:calendar-linear"
                    className="size-4 shrink-0 text-[var(--lp-muted)]"
                  />
                </p>
              </div>
              <Link
                href="/login"
                className="landing-btn landing-btn-primary shrink-0 whitespace-nowrap px-6 py-3.5"
              >
                Browse Properties
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap gap-8 sm:gap-12">
            <div className="flex items-start gap-3">
              <Image
                src="/landing/icon-renters.svg"
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0"
              />
              <div>
                <p className="text-lg font-bold text-[var(--lp-primary)]">
                  50k+ renters
                </p>
                <p className="text-sm text-[var(--lp-muted)]">
                  believe in our service
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Image
                src="/landing/icon-properties.svg"
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0"
              />
              <div>
                <p className="text-lg font-bold text-[var(--lp-primary)]">
                  10k+ properties
                </p>
                <p className="text-sm text-[var(--lp-muted)]">
                  and house ready for occupancy
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — house + floating cards */}
        <div className="relative mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none lg:justify-self-end">
          <div className="relative aspect-[731/886] w-full overflow-hidden rounded-[var(--lp-radius-xl)] lg:min-h-[560px] lg:aspect-auto">
            <Image
              src="/landing/hero-house.png"
              alt="Modern property"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>

          {/* Testimonial card */}
          <div className="absolute start-0 top-8 z-10 w-[min(100%,292px)] -translate-x-1 rounded-[var(--lp-radius-lg)] bg-white p-5 shadow-[var(--lp-shadow-float)] sm:start-[-12px] sm:w-[300px]">
            <div className="flex gap-3">
              <Image
                src="/landing/testimonial-avatar.png"
                alt="Manuel Villa"
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-[var(--lp-ink)]">
                  Manuel Villa
                </p>
                <p className="text-sm text-[var(--lp-muted)]">Renter</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[var(--lp-muted)]">
                  Moved with
                  <Image
                    src="/landing/logo.svg"
                    alt=""
                    width={14}
                    height={14}
                    className="inline-block size-3.5"
                  />
                  <span className="font-semibold text-[var(--lp-ink)]">
                    Paradis Immo
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--lp-ink)] text-white">
                <DashIcon icon="solar:quote-up-bold" className="size-4" />
              </span>
              <p className="text-[15px] leading-relaxed text-[var(--lp-ink)]">
                I loved how smooth the move was, and finally got the house we
                wanted.
              </p>
            </div>
            <div className="mt-4 flex justify-between border-t border-[var(--lp-border)] pt-4">
              <div>
                <p className="text-xl font-bold text-[var(--lp-ink)]">$1,500</p>
                <p className="text-xs text-[var(--lp-muted)]">Saved up to</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--lp-ink)]">−24 hrs</p>
                <p className="text-xs text-[var(--lp-muted)]">Process time</p>
              </div>
            </div>
          </div>

          {/* Trustpilot badge */}
          <div className="absolute bottom-0 end-0 z-10 rounded-tl-[var(--lp-radius-lg)] bg-[var(--lp-navy)] px-5 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold">Excellent</p>
              <DashIcon
                icon="solar:star-bold"
                className="size-4 text-[#00B67A]"
              />
              <p className="text-[15px] font-semibold">Trustpilot</p>
            </div>
            <div className="mt-2.5 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <DashIcon
                  key={i}
                  icon="solar:star-bold"
                  className="size-4 text-[#FFCE00]"
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium text-white/90">
              From 3,264 reviews
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
