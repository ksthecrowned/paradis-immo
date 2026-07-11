import { describe, expect, test } from 'bun:test';
import {
  mapPublicAgent,
  mapPublicOrganization,
  type PublicOrganization,
} from './map-organization';

const sample: PublicOrganization = {
  id: '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b',
  name: 'Agence Paradis Immo',
  type: 'PLATFORM',
  shortName: 'Paradis Immo',
  tagline: "L'agence officielle de la plateforme",
  address: 'Centre-ville, Pointe-Noire',
  phone: '+242 06 500 00 00',
  cityLabel: 'Pointe-Noire',
  logoColor: '#7065F0',
  isOfficial: true,
  verified: true,
  foundedYear: 2012,
  rating: 4.9,
  reviewCount: 128,
  dealSuccessPercent: 94,
};

describe('mapPublicOrganization', () => {
  test('maps official agency', () => {
    const agency = mapPublicOrganization(sample);
    expect(agency.id).toBe(sample.id);
    expect(agency.shortName).toBe('Paradis Immo');
    expect(agency.isOfficial).toBe(true);
    expect(agency.rating).toBe(4.9);
  });

  test('applies defaults for null marketing fields', () => {
    const agency = mapPublicOrganization({
      ...sample,
      shortName: null,
      tagline: null,
      address: null,
      phone: null,
      cityLabel: null,
      logoColor: null,
      foundedYear: null,
      rating: null,
      dealSuccessPercent: null,
    });
    expect(agency.shortName).toBe('Agence Paradis Immo');
    expect(agency.logoColor).toBe('#7065F0');
    expect(agency.city).toBe('Pointe-Noire');
    expect(agency.tagline).toBe('');
    expect(agency.rating).toBe(0);
    expect(agency.dealSuccessPercent).toBe(0);
    expect(agency.foundedYear).toBe(2012);
  });
});

describe('mapPublicAgent', () => {
  test('maps user id and defaults', () => {
    const agent = mapPublicAgent({
      id: '2a036ccd-fb37-4baf-ac47-ce70b42af47f',
      organizationId: sample.id,
      name: 'Agent Test',
      phone: '+242060000002',
    });
    expect(agent.id).toBe('2a036ccd-fb37-4baf-ac47-ce70b42af47f');
    expect(agent.agencyId).toBe(sample.id);
    expect(agent.displayName).toBe('Agent Test');
    expect(agent.initials).toBe('AT');
  });

  test('null name falls back', () => {
    const agent = mapPublicAgent({
      id: 'x',
      organizationId: sample.id,
      name: null,
      phone: null,
    });
    expect(agent.displayName).toBe('Conseiller');
    expect(agent.phone).toBe('');
  });
});
