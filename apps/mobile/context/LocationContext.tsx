import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';

export type UserCoords = {
  latitude: number;
  longitude: number;
};

export type UserLocationState = {
  coords: UserCoords | null;
  /** Human-readable place for UI (e.g. "Loandjili, Pointe-Noire"). */
  label: string;
  loading: boolean;
  denied: boolean;
  error: string | null;
  /** Request permission (if needed) and refresh GPS + reverse geocode. */
  refresh: () => Promise<UserCoords | null>;
};

const FALLBACK_LABEL = 'Pointe-Noire, Congo';
const FALLBACK_COORDS: UserCoords = {
  latitude: -4.7761,
  longitude: 11.8635,
};

let cachedCoords: UserCoords | null = null;
let cachedLabel: string | null = null;

function formatAddress(address: Location.LocationGeocodedAddress): string {
  const city =
    address.city ||
    address.subregion ||
    address.district ||
    address.region ||
    '';
  const area =
    address.district && address.district !== city
      ? address.district
      : address.street || address.name || '';
  const country = address.country || '';

  if (area && city) return `${area}, ${city}`;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return FALLBACK_LABEL;
}

async function reverseLabel(coords: UserCoords): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    const first = results[0];
    if (!first) return FALLBACK_LABEL;
    return formatAddress(first);
  } catch {
    return FALLBACK_LABEL;
  }
}

export async function getUserCoords(): Promise<UserCoords | null> {
  if (cachedCoords) return cachedCoords;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  cachedCoords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
  return cachedCoords;
}

const LocationContext = createContext<UserLocationState | null>(null);

export function LocationProvider({
  children,
  requestOnMount = true,
}: {
  children: ReactNode;
  requestOnMount?: boolean;
}): React.JSX.Element {
  const [coords, setCoords] = useState<UserCoords | null>(cachedCoords);
  const [label, setLabel] = useState(cachedLabel ?? FALLBACK_LABEL);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  const refresh = useCallback(async (): Promise<UserCoords | null> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        setCoords(null);
        setLabel(FALLBACK_LABEL);
        cachedCoords = null;
        cachedLabel = FALLBACK_LABEL;
        return null;
      }

      setDenied(false);
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next: UserCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const nextLabel = await reverseLabel(next);

      cachedCoords = next;
      cachedLabel = nextLabel;
      setCoords(next);
      setLabel(nextLabel);
      return next;
    } catch {
      setError('Impossible de récupérer votre position');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!requestOnMount || booted.current) return;
    booted.current = true;
    if (!cachedCoords) {
      void refresh();
    }
  }, [requestOnMount, refresh]);

  const value = useMemo<UserLocationState>(
    () => ({
      coords,
      label,
      loading,
      denied,
      error,
      refresh,
    }),
    [coords, label, loading, denied, error, refresh],
  );

  return (
    <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
  );
}

export function useUserLocation(): UserLocationState {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useUserLocation must be used within LocationProvider');
  }
  return ctx;
}

/** Coords for maps when GPS is unavailable (Pointe-Noire center). */
export function getFallbackCoords(): UserCoords {
  return FALLBACK_COORDS;
}
