import { apiFetch } from '@/lib/api';

export interface PublicCity {
  id: string;
  name: string;
  country: { id: string; code: string; name: string };
}

export interface PublicArrondissement {
  id: string;
  name: string;
  number: number | null;
  cityId: string;
}

export interface PublicQuartier {
  id: string;
  name: string;
  arrondissementId: string;
}

export async function listCities(countryCode = 'CG'): Promise<PublicCity[]> {
  return apiFetch<PublicCity[]>(
    `/locations/cities?countryCode=${encodeURIComponent(countryCode)}`,
    { anonymous: true },
  );
}

export async function listArrondissements(
  cityId: string,
): Promise<PublicArrondissement[]> {
  return apiFetch<PublicArrondissement[]>(
    `/locations/arrondissements?cityId=${encodeURIComponent(cityId)}`,
    { anonymous: true },
  );
}

export async function listQuartiers(
  arrondissementId: string,
): Promise<PublicQuartier[]> {
  return apiFetch<PublicQuartier[]>(
    `/locations/quartiers?arrondissementId=${encodeURIComponent(arrondissementId)}`,
    { anonymous: true },
  );
}
