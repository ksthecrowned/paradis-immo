import { Platform } from 'react-native';

/**
 * API base URL. Override with EXPO_PUBLIC_API_URL in .env
 * Android emulator: 10.0.2.2 maps to host localhost.
 */
export function getApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api/v1';
  }
  return 'http://localhost:3001/api/v1';
}
