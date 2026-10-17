import { apiFetch } from '@/lib/api';

export type AgencyClientLinkStatus =
  | 'UNLINKED'
  | 'CLAIM_PENDING'
  | 'LINKED'
  | 'CLAIM_DECLINED';

export type PublicAgencyClient = {
  id: string;
  organizationId: string;
  displayName: string;
  phoneE164: string | null;
  email: string | null;
  linkStatus: AgencyClientLinkStatus;
  userId: string | null;
  hasAccount: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  internalNote: string | null;
};

export type AgencyClientLookupResult = {
  exists: boolean;
  userId: string | null;
  displayName: string | null;
  phone: string;
  alreadyLinkedInOrg: boolean;
};

export type ListAgencyClientsFilter = 'all' | 'linked' | 'external' | 'archived';

type ListResponse = {
  data: PublicAgencyClient[];
  meta: { total: number; page: number; pageSize: number };
};

const base = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/clients`;

export async function listAgencyClients(
  organizationId: string,
  opts: {
    q?: string;
    filter?: ListAgencyClientsFilter;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.filter) params.set('filter', opts.filter);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  const qs = params.toString();
  return apiFetch<ListResponse>(`${base(organizationId)}${qs ? `?${qs}` : ''}`);
}

export async function listSelectableAgencyClients(
  organizationId: string,
  q?: string,
): Promise<PublicAgencyClient[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  return apiFetch<PublicAgencyClient[]>(
    `${base(organizationId)}/selectable${qs ? `?${qs}` : ''}`,
  );
}

export async function getAgencyClient(
  organizationId: string,
  clientId: string,
): Promise<PublicAgencyClient> {
  return apiFetch<PublicAgencyClient>(
    `${base(organizationId)}/${encodeURIComponent(clientId)}`,
  );
}

export async function lookupAgencyClientAccount(
  organizationId: string,
  phone: string,
): Promise<AgencyClientLookupResult> {
  return apiFetch<AgencyClientLookupResult>(`${base(organizationId)}/lookup`, {
    method: 'POST',
    body: { phone },
  });
}

export async function createExternalAgencyClient(
  organizationId: string,
  body: {
    displayName: string;
    phone: string;
    email?: string;
    internalNote?: string;
  },
): Promise<PublicAgencyClient> {
  return apiFetch<PublicAgencyClient>(`${base(organizationId)}/external`, {
    method: 'POST',
    body,
  });
}

export async function linkExistingAgencyClient(
  organizationId: string,
  phone: string,
): Promise<PublicAgencyClient> {
  return apiFetch<PublicAgencyClient>(`${base(organizationId)}/link`, {
    method: 'POST',
    body: { phone },
  });
}

export async function updateAgencyClient(
  organizationId: string,
  clientId: string,
  body: {
    displayName?: string;
    email?: string | null;
    internalNote?: string | null;
  },
): Promise<PublicAgencyClient> {
  return apiFetch<PublicAgencyClient>(
    `${base(organizationId)}/${encodeURIComponent(clientId)}`,
    { method: 'PATCH', body },
  );
}

export async function archiveAgencyClient(
  organizationId: string,
  clientId: string,
): Promise<PublicAgencyClient> {
  return apiFetch<PublicAgencyClient>(
    `${base(organizationId)}/${encodeURIComponent(clientId)}/archive`,
    { method: 'POST' },
  );
}

export function agencyClientKindLabel(client: PublicAgencyClient): string {
  if (client.archivedAt) return 'Archivé';
  return client.hasAccount ? 'Compte Paradis Immo' : 'Contact externe';
}
