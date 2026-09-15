import { APP_STORE_URL, PLAY_STORE_URL, hasStoreLinks } from '@/lib/store-links';
import Image from 'next/image';

const APP_STORE_BADGE = '/landing/badge-app-store.svg';
const PLAY_STORE_BADGE = '/landing/badge-google-play.svg';

interface LandingStoreBadgesProps {
  className?: string;
  /** Footer uses md; App CTA uses lg */
  size?: 'md' | 'lg';
}

const SIZES = {
  md: { height: 56, width: 188 },
  lg: { height: 72, width: 242 },
} as const;

function BadgeFace({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}): React.JSX.Element {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="landing-store-badge-img"
      style={{ width, height }}
      unoptimized
    />
  );
}

/**
 * Always renders both store faces at readable CTA size.
 * Links when URLs exist; otherwise honest “Bientôt”.
 */
export function LandingStoreBadges({
  className = '',
  size = 'md',
}: LandingStoreBadgesProps): React.JSX.Element {
  const { height, width } = SIZES[size];
  const ready = hasStoreLinks();

  const items: Array<{
    key: string;
    src: string;
    alt: string;
    href: string;
  }> = [
    {
      key: 'ios',
      src: APP_STORE_BADGE,
      alt: 'App Store',
      href: APP_STORE_URL,
    },
    {
      key: 'android',
      src: PLAY_STORE_BADGE,
      alt: 'Google Play',
      href: PLAY_STORE_URL,
    },
  ];

  return (
    <div className={`flex flex-col gap-3.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
        {items.map((item) =>
          item.href ? (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-store-badge inline-flex shrink-0 transition-transform hover:-translate-y-0.5"
              aria-label={`Télécharger sur ${item.alt}`}
            >
              <BadgeFace
                src={item.src}
                alt={item.alt}
                width={width}
                height={height}
              />
            </a>
          ) : (
            <span
              key={item.key}
              className="landing-store-badge landing-store-badge-soon inline-flex shrink-0"
              title="Bientôt disponible"
              aria-label={`${item.alt} — bientôt disponible`}
            >
              <BadgeFace
                src={item.src}
                alt={item.alt}
                width={width}
                height={height}
              />
            </span>
          ),
        )}
      </div>
      {!ready ? (
        <p className="text-[14px] font-medium tracking-wide text-(--lp-primary)">
          Bientôt sur l’App Store et Google Play
        </p>
      ) : null}
    </div>
  );
}
