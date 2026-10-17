import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. Non-development builds must receive an explicit environment URL;
 * silently falling back to production could make preview tests mutate live data.
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

  const extra = Constants.expoConfig?.extra as
    | { apiUrl?: string }
    | undefined;
  if (extra?.apiUrl?.trim()) {
    return extra.apiUrl.trim().replace(/\/$/, '');
  }

  throw new Error(
    'EXPO_PUBLIC_API_URL must be configured for non-development builds.',
  );
}
