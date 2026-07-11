export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'paradis-immo-theme';

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function resolveTheme(stored: ThemeMode | null = readStoredTheme()): ThemeMode {
  return stored ?? getSystemTheme();
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-bs-theme', theme);
  root.setAttribute('data-topbar-color', theme);
  root.setAttribute('data-sidebar-color', theme);
  root.style.colorScheme = theme;
}

export function persistTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Write theme to storage + DOM and notify React subscribers. */
export function writeTheme(theme: ThemeMode): void {
  persistTheme(theme);
  applyTheme(theme);
  emit();
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      listener();
    }
  };

  const media = window.matchMedia('(prefers-color-scheme: light)');
  const onMedia = (): void => {
    if (readStoredTheme() === null) {
      applyTheme(resolveTheme(null));
      listener();
    }
  };

  window.addEventListener('storage', onStorage);
  media.addEventListener('change', onMedia);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', onMedia);
  };
}

export function getThemeSnapshot(): ThemeMode {
  return resolveTheme();
}

export function getServerThemeSnapshot(): ThemeMode {
  return 'dark';
}
