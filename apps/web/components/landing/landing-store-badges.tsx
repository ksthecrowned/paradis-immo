import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';

const APP_STORE_BADGE = '/aivalable-on-the-app-store-2-logo-svgrepo-com.svg';
const PLAY_STORE_BADGE = '/google-play-download-android-app-logo-svgrepo-com.svg';

interface LandingStoreBadgesProps {
  className?: string;
  /** Light badges on dark navy sections */
  onDark?: boolean;
}

export function LandingStoreBadges({
  className = '',
  onDark = false,
}: LandingStoreBadgesProps): React.JSX.Element {
  const appHref = APP_STORE_URL || '#download';
  const playHref = PLAY_STORE_URL || '#download';
  const hasLinks = Boolean(APP_STORE_URL || PLAY_STORE_URL);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={appHref}
        {...(APP_STORE_URL
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className="inline-flex transition-opacity hover:opacity-90"
        aria-label="Télécharger sur l’App Store"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={APP_STORE_BADGE}
          alt="Disponible sur l’App Store"
          width={148}
          height={44}
          className="h-11 w-auto"
        />
      </a>
      <a
        href={playHref}
        {...(PLAY_STORE_URL
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className="inline-flex transition-opacity hover:opacity-90"
        aria-label="Télécharger sur Google Play"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PLAY_STORE_BADGE}
          alt="Disponible sur Google Play"
          width={148}
          height={44}
          className="h-11 w-auto"
        />
      </a>
      {!hasLinks ? (
        <span
          className={`text-sm ${onDark ? 'text-white/55' : 'text-[var(--lp-muted)]'}`}
        >
          Bientôt disponible
        </span>
      ) : null}
    </div>
  );
}
