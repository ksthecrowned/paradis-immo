import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL.
 * Priority: EXPO_PUBLIC_API_URL → (dev) emulator/localhost → app.json extra.apiUrl
 */
export function getApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (__DEV__) {
    // Do not use expoConfig.extra.apiUrl in dev — it is baked into the binary
    // and would bypass the local/LAN API.
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3001/api/v1';
    }
    return 'http://localhost:3001/api/v1';
  }

  const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
  if (extra.apiUrl?.trim()) {
    return extra.apiUrl.trim().replace(/\/$/, '');
  }

  return 'https://paradis-immo.onrender.com/api/v1';
}
