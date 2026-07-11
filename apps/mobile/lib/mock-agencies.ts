export type Agency = {
  id: string;
  name: string;
  shortName: string;
  city: string;
  logoColor: string;
};

export type Agent = {
  id: string;
  agencyId: string;
  displayName: string;
  initials: string;
};

export const MOCK_AGENCIES: Agency[] = [
  {
    id: 'ag-cote-sauvage',
    name: 'Agence Côte Sauvage',
    shortName: 'Côte Sauvage',
    city: 'Pointe-Noire',
    logoColor: '#0F766E',
  },
  {
    id: 'ag-habitat-pn',
    name: 'Habitat Pointe-Noire',
    shortName: 'Habitat PN',
    city: 'Pointe-Noire',
    logoColor: '#B45309',
  },
  {
    id: 'ag-mongo-immo',
    name: 'Mongo Immo',
    shortName: 'Mongo Immo',
    city: 'Pointe-Noire',
    logoColor: '#1D4ED8',
  },
];

export const MOCK_AGENTS: Agent[] = [
  {
    id: 'ag-cote-sauvage-1',
    agencyId: 'ag-cote-sauvage',
    displayName: 'Grace Mabiala',
    initials: 'GM',
  },
  {
    id: 'ag-cote-sauvage-2',
    agencyId: 'ag-cote-sauvage',
    displayName: 'Jean Kouka',
    initials: 'JK',
  },
  {
    id: 'ag-habitat-pn-1',
    agencyId: 'ag-habitat-pn',
    displayName: 'Amina Nguimbi',
    initials: 'AN',
  },
  {
    id: 'ag-habitat-pn-2',
    agencyId: 'ag-habitat-pn',
    displayName: 'Paul Okemba',
    initials: 'PO',
  },
  {
    id: 'ag-mongo-immo-1',
    agencyId: 'ag-mongo-immo',
    displayName: 'Sarah Louzolo',
    initials: 'SL',
  },
  {
    id: 'ag-mongo-immo-2',
    agencyId: 'ag-mongo-immo',
    displayName: 'Didier Massamba',
    initials: 'DM',
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
