import { apiFetch, ApiError } from '@/lib/api';

export interface PublicFavorite {
  id: string;
  propertyId: string;
  createdAt: string;
}

const LOCAL_KEY = 'paradisImmo.favorites';

async function readLocalIds(): Promise<string[]> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

async function writeLocalIds(ids: string[]): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(ids));
}

export async function listFavorites(): Promise<PublicFavorite[]> {
  return apiFetch<PublicFavorite[]>('/favorites');
}

export async function listFavoriteIds(): Promise<string[]> {
  try {
    const rows = await listFavorites();
    const ids = rows.map((r) => r.propertyId);
    await writeLocalIds(ids);
    return ids;
  } catch {
    return readLocalIds();
  }
}

export async function isFavorite(propertyId: string): Promise<boolean> {
  const ids = await listFavoriteIds();
  return ids.includes(propertyId);
}

export async function addFavorite(propertyId: string): Promise<void> {
  try {
    await apiFetch<PublicFavorite>('/favorites', {
      method: 'POST',
      body: { propertyId },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // already favorited
    } else {
      throw err;
    }
  }
  const ids = await readLocalIds();
  if (!ids.includes(propertyId)) {
    await writeLocalIds([propertyId, ...ids]);
  }
}

export async function removeFavorite(propertyId: string): Promise<void> {
  try {
    await apiFetch<void>(`/favorites/${propertyId}`, { method: 'DELETE' });
  } catch {
    // keep local removal even if server row is already gone
  }
  const ids = await readLocalIds();
  await writeLocalIds(ids.filter((id) => id !== propertyId));
}

export async function toggleFavorite(propertyId: string): Promise<boolean> {
  const exists = await isFavorite(propertyId);
  if (exists) {
    await removeFavorite(propertyId);
    return false;
  }
  await addFavorite(propertyId);
  return true;
}

/** Merge legacy local favorites into the API after login. */
export async function syncLocalFavoritesToServer(): Promise<void> {
  const local = await readLocalIds();
  if (local.length === 0) return;
  await Promise.all(
    local.map(async (propertyId) => {
      try {
        await addFavorite(propertyId);
      } catch {
        // ignore per-item failures
      }
    }),
  );
}
