import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'paradisImmo.installId';

/** Persistent install id used as anonymous view fingerprint. */
export async function getInstallId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing && existing.length >= 1 && existing.length <= 64) {
    return existing;
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(KEY, id);
  return id;
}
