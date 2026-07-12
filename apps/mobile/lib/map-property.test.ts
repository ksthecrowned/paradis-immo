import { describe, expect, test } from 'bun:test';
import { mapPublicProperty } from './map-property';
import type { PublicProperty } from './properties';

const base: PublicProperty = {
  id: '823b9231-0eb7-4550-8dc6-892fd686496d',
  title: 'Appartement Centre-ville',
  description: 'Desc',
  type: 'APARTMENT',
  mode: 'RENT_LONG',
  status: 'ACTIVE',
  price: 100000,
  currency: 'XAF',
  priceUnit: 'MONTH',
  address: 'Centre',
  lat: -4.77,
  lng: 11.86,
  bedrooms: 3,
  bathrooms: 1,
  surface: 95,
  visitEnabled: true,
  visitType: 'FREE',
  visitPrice: null,
  visitDuration: null,
  features: ['wifi', 'cuisine'],
  listingStatus: 'OCCUPIED',
  availableFrom: null,
  isFeatured: false,
  floor: '2e étage',
  yearBuilt: 2012,
  condition: 'Bon état',
  lotSize: null,
  parkingSpaces: 1,
  orientation: 'Est',
  landTitle: null,
  mapViews: ['neighborhood'],
  media: [
    {
      id: 'm1',
      url: 'https://example.com/house2.jpg',
      type: 'PHOTO',
      position: 0,
    },
    {
      id: 'm2',
      url: 'https://example.com/house3.jpg',
      type: 'PHOTO',
      position: 1,
    },
  ],
  quartier: {
    id: 'q1',
    name: 'Lumumba-Centre',
    arrondissement: {
      id: 'a1',
      name: 'Lumumba',
      city: { id: 'c1', name: 'Pointe-Noire' },
    },
  },
  organization: {
    id: '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b',
    name: 'Paradis Immo',
    type: 'AGENCY',
  },
  ownerOrg: {
    id: '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b',
    name: 'Paradis Immo',
    type: 'AGENCY',
  },
  agent: {
    id: '2a036ccd-fb37-4baf-ac47-ce70b42af47f',
    name: 'Agent Test',
    phone: '+242060000002',
  },
  ownerId: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('mapPublicProperty', () => {
  test('maps cover and occupied listing', () => {
    const p = mapPublicProperty(base);
    expect(p.coverImage).toContain('house2');
    expect(p.images?.[0]).toContain('house3');
    expect(p.listingStatus).toBe('OCCUPIED');
    expect(p.agencyId).toBe(base.organization!.id);
    expect(p.location).toContain('Pointe-Noire');
    expect(p.priceAmount).toBe(100000);
    expect(p.cityId).toBe('c1');
    expect(p.quartierId).toBe('q1');
  });

  test('maps UNDER_OFFER and featured', () => {
    const p = mapPublicProperty({
      ...base,
      mode: 'SALE',
      listingStatus: 'UNDER_OFFER',
      availableFrom: null,
      isFeatured: true,
    });
    expect(p.listingStatus).toBe('UNDER_OFFER');
    expect(p.isFeatured).toBe(true);
  });

  test('maps visit FREE fields', () => {
    const p = mapPublicProperty(base);
    expect(p.visitEnabled).toBe(true);
    expect(p.visitType).toBe('FREE');
    expect(p.visitPrice).toBeNull();
  });

  test('maps visit PAID fields', () => {
    const p = mapPublicProperty({
      ...base,
      visitType: 'PAID',
      visitPrice: 5000,
    });
    expect(p.visitType).toBe('PAID');
    expect(p.visitPrice).toBe(5000);
  });
});
