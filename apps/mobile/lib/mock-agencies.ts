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

export const MOCK_AGENCIES: Agency[] = [
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
  },
];

export const MOCK_AGENTS: Agent[] = [
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

export function listAgencies(): Agency[] {
  return MOCK_AGENCIES;
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

export {
  listPropertiesByAgency,
  listPropertiesByAgent,
} from './mock-properties';
