/**
 * Theme bootstrap, then register the Expo Router root.
 * Do not call Appearance.setColorScheme(null) — crashes on RN 0.86 Android
 * (NullPointerException). Use 'unspecified' to follow the system theme.
 */
const { Appearance } = require('react-native');
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const PREFS_KEY = 'paradisImmo.userPreferences';

function resolveScheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

global.__PARADIS_THEME__ =
  Appearance.getColorScheme() === 'light' ? 'light' : 'dark';

require('expo-router/entry');

AsyncStorage.getItem(PREFS_KEY)
  .then((raw) => {
    let theme = 'system';
    try {
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.theme === 'string') {
          theme = parsed.theme;
        }
      }
    } catch {
      /* keep system */
    }

    const scheme = resolveScheme(theme);
    if (theme === 'light' || theme === 'dark') {
      Appearance.setColorScheme(theme);
    } else {
      Appearance.setColorScheme('unspecified');
    }
    global.__PARADIS_THEME__ = scheme;
  })
  .catch(() => {
    /* ignore storage errors */
  });
