import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'paradisImmo.userPreferences';

export type ThemePreference = 'system' | 'light' | 'dark';

export type UserPreferences = {
  theme: ThemePreference;
  pushEnabled: boolean;
};

export const DEFAULT_PREFS: UserPreferences = {
  theme: 'system',
  pushEnabled: true,
};

export async function getUserPreferences(): Promise<UserPreferences> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme ?? DEFAULT_PREFS.theme,
      pushEnabled:
        typeof parsed.pushEnabled === 'boolean'
          ? parsed.pushEnabled
          : DEFAULT_PREFS.pushEnabled,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function setUserPreferences(
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const current = await getUserPreferences();
  const next: UserPreferences = {
    ...current,
    ...patch,
  };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}
