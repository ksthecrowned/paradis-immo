import { describe, expect, test } from 'bun:test';
import { getPropertyGalleryUrls } from './property-gallery-urls';
import type { Property } from '@/types/property';

function base(partial: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    title: 'Test',
    description: '',
    price: '10 000 FCFA',
    priceAmount: 10_000,
    coverImage: '',
    mode: 'RENT_SHORT',
    agencyId: 'ag',
    agentId: 'agent',
    listingStatus: 'AVAILABLE',
    lat: 0,
    lng: 0,
    ...partial,
  };
}

describe('getPropertyGalleryUrls', () => {
  test('prefers mediaItems photos', () => {
    const urls = getPropertyGalleryUrls(
      base({
        mediaItems: [
          { url: 'https://cdn.example/a.jpg', type: 'PHOTO' },
          { url: 'https://cdn.example/b.mp4', type: 'VIDEO' },
          { url: 'https://cdn.example/c.jpg', type: 'PHOTO' },
        ],
      }),
    );
    expect(urls).toEqual([
      'https://cdn.example/a.jpg',
      'https://cdn.example/c.jpg',
    ]);
  });

  test('falls back to coverImage + images', () => {
    const urls = getPropertyGalleryUrls(
      base({
        coverImage: 'https://cdn.example/cover.jpg',
        images: ['https://cdn.example/2.jpg'],
      }),
    );
    expect(urls).toEqual([
      'https://cdn.example/cover.jpg',
      'https://cdn.example/2.jpg',
    ]);
  });

  test('returns empty when no media', () => {
    expect(getPropertyGalleryUrls(base())).toEqual([]);
  });
});
