'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Icon } from '@iconify/react';

export type MediaGalleryItem = {
  id: string;
  url: string;
  alt?: string;
  /** Optional caption rendered under the image. */
  caption?: string;
};

export type MediaGalleryProps = {
  items: MediaGalleryItem[];
  className?: string;
  emptyLabel?: string;
};

/**
 * MediaGallery — responsive grid of media with a click-to-preview
 * lightbox. Used on detail pages to display property media, agent
 * portfolios, etc.
 */
export function MediaGallery({
  items,
  className = '',
  emptyLabel = 'Aucun média.',
}: MediaGalleryProps): React.JSX.Element {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-label={`Aperçu ${idx + 1} sur ${items.length}`}
          >
            <Image
              src={item.url}
              alt={item.alt ?? ''}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              unoptimized
              className="object-cover transition-transform group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Icon icon="mdi:arrow-expand" className="h-3 w-3" />
            </span>
            {item.caption ? (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-xs text-white">
                {item.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeIdx !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActiveIdx(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIdx(null);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Fermer"
          >
            <Icon icon="mdi:close" className="h-6 w-6" />
          </button>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx((i) => (i! - 1 + items.length) % items.length);
                }}
                className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Précédent"
              >
                <Icon icon="mdi:chevron-left" className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx((i) => (i! + 1) % items.length);
                }}
                className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Suivant"
              >
                <Icon icon="mdi:chevron-right" className="h-6 w-6" />
              </button>
            </>
          ) : null}
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={items[activeIdx].url}
              alt={items[activeIdx].alt ?? ''}
              width={1600}
              height={1200}
              unoptimized
              className="max-h-[90vh] w-auto max-w-[90vw] rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-white/80">
              {activeIdx + 1} / {items.length}
              {items[activeIdx].caption ? ` — ${items[activeIdx].caption}` : null}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
