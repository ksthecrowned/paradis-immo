import Image from 'next/image';
import Link from 'next/link';

export function LandingLogo({
  className = '',
  textClassName = '',
  /** Hide the wordmark — mark only. */
  markOnly = false,
  size = 40,
}: {
  className?: string;
  textClassName?: string;
  markOnly?: boolean;
  size?: number;
}): React.JSX.Element {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <Image
        src="/landing/logo.png"
        alt={markOnly ? 'Paradis Immobilier' : ''}
        width={size}
        height={size}
        className="shrink-0"
        style={{ width: size, height: size }}
        priority
      />
      {!markOnly ? (
        <span
          className={`text-[20px] font-semibold leading-none tracking-tight text-[var(--lp-ink)] ${textClassName}`}
        >
          Paradis Immobilier
        </span>
      ) : null}
    </Link>
  );
}
