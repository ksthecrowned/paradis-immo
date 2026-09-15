import { APP_STORE_URL, PLAY_STORE_URL, hasStoreLinks } from '@/lib/store-links';
import Image from 'next/image';

const APP_STORE_BADGE = '/aivalable-on-the-app-store-2-logo-svgrepo-com.svg';
const PLAY_STORE_BADGE = '/google-play-download-android-app-logo-svgrepo-com.svg';

interface LandingStoreBadgesProps {
  className?: string;
  onDark?: boolean;
}

/**
 * Show real store badges only when URLs exist.
 * Otherwise a single honest status — never fake “Available on…” buttons.
 */
export function LandingStoreBadges({
  className = '',
  onDark = false,
}: LandingStoreBadgesProps): React.JSX.Element {
  if (!hasStoreLinks()) {
    return (
      <p
        className={`text-[15px] ${onDark ? 'text-white/60' : 'text-[var(--lp-muted)]'} ${className}`}
      >
        Bientôt disponible sur l’App Store et Google Play.
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {APP_STORE_URL ? (
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex transition-opacity hover:opacity-90"
          aria-label="Télécharger sur l’App Store"
        >
          <Image
            src={APP_STORE_BADGE}
            alt="Télécharger sur l’App Store"
            width={148}
            height={44}
            style={{ width: 'auto', height: '2.75rem' }}
          />
        </a>
      ) : null}
      {PLAY_STORE_URL ? (
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex transition-opacity hover:opacity-90"
          aria-label="Télécharger sur Google Play"
        >
          <Image
            src={PLAY_STORE_BADGE}
            alt="Télécharger sur Google Play"
            width={148}
            height={44}
            style={{ width: 'auto', height: '2.75rem' }}
          />
        </a>
      ) : null}
    </div>
  );
}
