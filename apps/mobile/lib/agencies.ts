import { apiFetch } from '@/lib/api';
import {
  mapPublicAgent,
  mapPublicOrganization,
  type Agency,
  type Agent,
  type PublicAgent,
  type PublicOrganization,
} from '@/lib/map-organization';

export type { Agency, Agent };

type PublicOrganizationDetail = PublicOrganization & {
  agents: PublicAgent[];
};

const agencyCache = new Map<string, Agency>();
const agentsByAgency = new Map<string, Agent[]>();
const agentById = new Map<string, Agent>();

function rememberAgency(agency: Agency, agents: Agent[] = []): void {
  agencyCache.set(agency.id, agency);
  if (agents.length > 0) {
    agentsByAgency.set(agency.id, agents);
    for (const agent of agents) {
      agentById.set(agent.id, agent);
    }
  } else if (!agentsByAgency.has(agency.id)) {
    agentsByAgency.set(agency.id, []);
  }
}

export async function fetchAgencies(): Promise<Agency[]> {
  const res = await apiFetch<{ data: PublicOrganization[] } | PublicOrganization[]>(
    '/organizations',
    { anonymous: true },
  );
  const rows = Array.isArray(res) ? res : (res.data ?? []);
  const agencies = rows.map(mapPublicOrganization);
  for (const agency of agencies) {
    rememberAgency(agency, agentsByAgency.get(agency.id) ?? []);
  }
  return agencies;
}

export async function fetchAgency(
  id: string,
): Promise<Agency & { agents: Agent[] }> {
  const res = await apiFetch<PublicOrganizationDetail>(`/organizations/${id}`, {
    anonymous: true,
  });
  const agency = mapPublicOrganization(res);
  const agents = (res.agents ?? []).map(mapPublicAgent);
  rememberAgency(agency, agents);
  return { ...agency, agents };
}

export function getCachedAgency(id: string): Agency | undefined {
  return agencyCache.get(id);
}

export function listCachedAgencies(): Agency[] {
  return [...agencyCache.values()].sort(
    (a, b) => Number(b.isOfficial) - Number(a.isOfficial),
  );
}

export function listCachedAgentsByAgency(agencyId: string): Agent[] {
  return agentsByAgency.get(agencyId) ?? [];
}

export function getCachedAgent(id: string): Agent | undefined {
  return agentById.get(id);
}

export function getAgency(id: string): Agency | undefined {
  return getCachedAgency(id);
}

export function listAgencies(): Agency[] {
  return listCachedAgencies();
}

export function listAgentsByAgency(agencyId: string): Agent[] {
  return listCachedAgentsByAgency(agencyId);
}

export function getAgent(id: string): Agent | undefined {
  return getCachedAgent(id);
}

export function isOfficialAgency(id: string): boolean {
  return getCachedAgency(id)?.isOfficial === true;
}
