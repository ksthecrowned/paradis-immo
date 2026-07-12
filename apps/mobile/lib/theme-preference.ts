import { reloadAppAsync } from 'expo';
import { Appearance } from 'react-native';
import {
  getUserPreferences,
  setUserPreferences,
  type ThemePreference,
  type UserPreferences,
} from '@/lib/user-preferences';

function resolveScheme(
  theme: ThemePreference,
): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

/**
 * Persist theme preference and reload so StyleSheets pick the new palette.
 */
export async function applyThemePreference(
  theme: ThemePreference,
): Promise<UserPreferences> {
  const next = await setUserPreferences({ theme });
  const scheme = resolveScheme(theme);
  globalThis.__PARADIS_THEME__ = scheme;
  if (theme === 'light' || theme === 'dark') {
    Appearance.setColorScheme(theme);
  } else {
    // RN 0.82+: null crashes on Android (NPE). Use 'unspecified' for system.
    Appearance.setColorScheme('unspecified');
  }
  await reloadAppAsync();
  return next;
}

export async function getResolvedColorScheme(): Promise<'light' | 'dark'> {
  const prefs = await getUserPreferences();
  return resolveScheme(prefs.theme);
}
