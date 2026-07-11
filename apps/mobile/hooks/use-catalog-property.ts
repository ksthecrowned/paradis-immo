import { fetchCatalogProperty } from '@/lib/catalog';
import type { Property } from '@/types/property';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** Load a catalog property by id (API). */
export function useCatalogProperty(id: string): {
  property: Property | null;
  loading: boolean;
  error: string | null;
} {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!id) {
          setProperty(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        try {
          const row = await fetchCatalogProperty(id);
          if (active) setProperty(row);
        } catch {
          if (active) {
            setProperty(null);
            setError('Impossible de charger ce bien');
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [id]),
  );

  return { property, loading, error };
}
