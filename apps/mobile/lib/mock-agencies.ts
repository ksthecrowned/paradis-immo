export type Agency = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  logoColor: string;
  /** Short pitch shown on hub. */
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

export const MOCK_AGENCIES: Agency[] = [
  {
    id: 'ag-paradis-immo',
    name: 'Agence Paradis Immo',
    shortName: 'Paradis Immo',
    city: 'Pointe-Noire',
    logoColor: '#7065F0',
    tagline: 'L’agence officielle de la plateforme',
    address: 'Centre-ville, Pointe-Noire',
    phone: '+242 06 500 00 00',
    verified: true,
    foundedYear: 2012,
    isOfficial: true,
    rating: 4.9,
    reviewCount: 128,
    dealSuccessPercent: 94,
  },
  {
    id: 'ag-cote-sauvage',
    name: 'Agence Côte Sauvage',
    shortName: 'Côte Sauvage',
    city: 'Pointe-Noire',
    logoColor: '#0F766E',
    tagline: 'Villas et locations en bord de mer',
    address: 'Av. de la Côte, Loandjili',
    phone: '+242 06 500 11 22',
    verified: true,
    foundedYear: 2014,
    isOfficial: false,
    rating: 4.6,
    reviewCount: 42,
    dealSuccessPercent: 88,
  },
  {
    id: 'ag-habitat-pn',
    name: 'Habitat Pointe-Noire',
    shortName: 'Habitat PN',
    city: 'Pointe-Noire',
    logoColor: '#B45309',
    tagline: 'Appartements et bureaux au centre-ville',
    address: 'Bd. Général de Gaulle, Centre-ville',
    phone: '+242 06 500 33 44',
    verified: true,
    foundedYear: 2018,
    isOfficial: false,
    rating: 4.4,
    reviewCount: 31,
    dealSuccessPercent: 82,
  },
  {
    id: 'ag-mongo-immo',
    name: 'Mongo Immo',
    shortName: 'Mongo Immo',
    city: 'Pointe-Noire',
    logoColor: '#1D4ED8',
    tagline: 'Terrains et projets d’investissement',
    address: 'Quartier Mongo-Poukou',
    phone: '+242 06 500 55 66',
    verified: false,
    foundedYear: 2021,
    isOfficial: false,
    rating: 4.1,
    reviewCount: 12,
    dealSuccessPercent: 75,
  },
];

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'ag-paradis-immo-1',
    agencyId: 'ag-paradis-immo',
    displayName: 'Claire Mouanda',
    initials: 'CM',
    role: 'Conseillère senior',
    phone: '+242 06 600 00 01',
    specialty: 'Vente & mandats',
    yearsExperience: 9,
  },
  {
    id: 'ag-paradis-immo-2',
    agencyId: 'ag-paradis-immo',
    displayName: 'Eric Makosso',
    initials: 'EM',
    role: 'Conseiller location',
    phone: '+242 06 600 00 02',
    specialty: 'Location longue durée',
    yearsExperience: 6,
  },
  {
    id: 'ag-cote-sauvage-1',
    agencyId: 'ag-cote-sauvage',
    displayName: 'Grace Mabiala',
    initials: 'GM',
    role: 'Conseillère vente',
    phone: '+242 06 611 01 01',
    specialty: 'Villas familiales',
    yearsExperience: 8,
  },
  {
    id: 'ag-cote-sauvage-2',
    agencyId: 'ag-cote-sauvage',
    displayName: 'Jean Kouka',
    initials: 'JK',
    role: 'Conseiller location',
    phone: '+242 06 611 01 02',
    specialty: 'Séjours & courte durée',
    yearsExperience: 5,
  },
  {
    id: 'ag-habitat-pn-1',
    agencyId: 'ag-habitat-pn',
    displayName: 'Amina Nguimbi',
    initials: 'AN',
    role: 'Responsable portefeuille',
    phone: '+242 06 622 02 01',
    specialty: 'Location longue durée',
    yearsExperience: 10,
  },
  {
    id: 'ag-habitat-pn-2',
    agencyId: 'ag-habitat-pn',
    displayName: 'Paul Okemba',
    initials: 'PO',
    role: 'Conseiller immobilier',
    phone: '+242 06 622 02 02',
    specialty: 'Appartements centre-ville',
    yearsExperience: 4,
  },
  {
    id: 'ag-mongo-immo-1',
    agencyId: 'ag-mongo-immo',
    displayName: 'Sarah Louzolo',
    initials: 'SL',
    role: 'Conseillère foncière',
    phone: '+242 06 633 03 01',
    specialty: 'Terrains constructibles',
    yearsExperience: 6,
  },
  {
    id: 'ag-mongo-immo-2',
    agencyId: 'ag-mongo-immo',
    displayName: 'Didier Massamba',
    initials: 'DM',
    role: 'Conseiller investissement',
    phone: '+242 06 633 03 02',
    specialty: 'Projets locatifs',
    yearsExperience: 7,
  },
];

export const MOCK_AGENCY_REVIEWS: AgencyReview[] = [
  {
    id: 'rev-pi-1',
    agencyId: 'ag-paradis-immo',
    authorName: 'Patricia K.',
    propertyTitle: 'Villa Whispering Pines',
    body: 'Accompagnement clair du premier contact à la visite. Équipe réactive et professionnelle.',
    rating: 5,
    createdLabel: 'Il y a 2 semaines',
  },
  {
    id: 'rev-pi-2',
    agencyId: 'ag-paradis-immo',
    authorName: 'Marc T.',
    propertyTitle: 'Appartement Centre-ville',
    body: 'Très bon suivi pour la location. Les créneaux de visite étaient bien organisés.',
    rating: 5,
    createdLabel: 'Il y a 1 mois',
  },
  {
    id: 'rev-pi-3',
    agencyId: 'ag-paradis-immo',
    authorName: 'Nadia B.',
    propertyTitle: 'Maison Tié-Tié',
    body: 'Agence sérieuse, informations transparentes sur le bien et le quartier.',
    rating: 4,
    createdLabel: 'Il y a 2 mois',
  },
  {
    id: 'rev-cs-1',
    agencyId: 'ag-cote-sauvage',
    authorName: 'Hervé L.',
    propertyTitle: 'Maison Tié-Tié',
    body: 'Bon accueil pour une location à la journée. Je recommande.',
    rating: 5,
    createdLabel: 'Il y a 3 semaines',
  },
];

export function listAgencies(): Agency[] {
  return [...MOCK_AGENCIES].sort(
    (a, b) => Number(b.isOfficial) - Number(a.isOfficial),
  );
}

export function getAgency(id: string): Agency | undefined {
  return MOCK_AGENCIES.find((agency) => agency.id === id);
}

export function listAgentsByAgency(agencyId: string): Agent[] {
  return MOCK_AGENTS.filter((agent) => agent.agencyId === agencyId);
}

export function getAgent(id: string): Agent | undefined {
  return MOCK_AGENTS.find((agent) => agent.id === id);
}

export function listAgencyReviews(agencyId: string): AgencyReview[] {
  return MOCK_AGENCY_REVIEWS.filter((review) => review.agencyId === agencyId);
}

export function isOfficialAgency(id: string): boolean {
  return getAgency(id)?.isOfficial === true;
}

export {
  listPropertiesByAgency,
  listPropertiesByAgent,
} from './mock-properties';
