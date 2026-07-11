import Image from 'next/image';
import Link from 'next/link';

export function LandingLogo({
  className = '',
  textClassName = '',
}: {
  className?: string;
  textClassName?: string;
}): React.JSX.Element {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Image
        src="/landing/logo.svg"
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0"
        priority
      />
      <span
        className={`text-[22px] font-bold leading-none tracking-tight text-[var(--lp-ink)] ${textClassName}`}
      >
        Paradis Immo
      </span>
    </Link>
  );
}
