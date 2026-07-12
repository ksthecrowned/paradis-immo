import Link from 'next/link';

export function LandingCta(): React.JSX.Element {
  return (
    <section
      id="cta"
      className="flex flex-col items-center bg-[var(--lp-primary-muted)] px-5 py-16 text-center md:py-20"
    >
      <p className="text-xl font-semibold capitalize text-[var(--lp-primary)] md:text-2xl">
        No spam promise
      </p>
      <h2 className="mt-3 text-[32px] font-bold text-[var(--lp-ink)] md:text-[48px]">
        Are you a landlord?
      </h2>
      <p className="mt-4 max-w-lg text-[15px] text-[var(--lp-muted)]">
        Discover ways to increase your home&apos;s value and get listed. No
        spam.
      </p>
      <form
        className="mt-8 flex w-full max-w-xl flex-col gap-3 rounded-[var(--lp-radius-md)] bg-[var(--lp-surface)] p-2 shadow-[var(--lp-shadow-card)] sm:flex-row sm:items-center"
        action="/login"
      >
        <input
          type="email"
          name="email"
          placeholder="Enter your email address"
          className="flex-1 rounded-[var(--lp-radius-sm)] bg-[var(--lp-surface)] px-4 py-3 text-[15px] text-[var(--lp-ink)] outline-none placeholder:text-[var(--lp-muted)]"
        />
        <Link
          href="/login"
          className="landing-btn landing-btn-primary px-8 py-3"
        >
          Submit
        </Link>
      </form>
    </section>
  );
}
