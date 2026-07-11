export type Agency = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  logoColor: string;
  tagline: string;
  address: string;
  phone: string;
  verified: boolean;
  foundedYear: number;
  isOfficial: boolean;
  rating: number;
  reviewCount: number;
  dealSuccessPercent: number;
};

export type Agent = {
  id: string;
  agencyId: string;
  displayName: string;
  initials: string;
  role: string;
  phone: string;
  specialty: string;
  yearsExperience: number;
};

export type AgencyReview = {
  id: string;
  agencyId: string;
  authorName: string;
  propertyTitle: string;
  body: string;
  rating: number;
  createdLabel: string;
};

export type PublicOrganization = {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  cityLabel: string | null;
  logoColor: string | null;
  isOfficial: boolean;
  verified: boolean;
  foundedYear: number | null;
  rating: number | null;
  reviewCount: number;
  dealSuccessPercent: number | null;
};

export type PublicAgent = {
  id: string;
  organizationId: string;
  name: string | null;
  phone: string | null;
};

const BRAND = '#7065F0';

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return letters || 'AG';
}

export function mapPublicOrganization(api: PublicOrganization): Agency {
  return {
    id: api.id,
    name: api.name,
    shortName: api.shortName?.trim() || api.name,
    city: api.cityLabel?.trim() || 'Pointe-Noire',
    logoColor: api.logoColor?.trim() || BRAND,
    tagline: api.tagline ?? '',
    address: api.address ?? '',
    phone: api.phone ?? '',
    verified: api.verified,
    foundedYear: api.foundedYear ?? 2012,
    isOfficial: api.isOfficial,
    rating: api.rating ?? 0,
    reviewCount: api.reviewCount ?? 0,
    dealSuccessPercent: api.dealSuccessPercent ?? 0,
  };
}

export function mapPublicAgent(api: PublicAgent): Agent {
  const displayName = api.name?.trim() || 'Conseiller';
  return {
    id: api.id,
    agencyId: api.organizationId,
    displayName,
    initials: initialsFromName(displayName),
    role: 'Conseiller',
    phone: api.phone ?? '',
    specialty: 'Immobilier',
    yearsExperience: 1,
  };
}
