import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'paradisImmo.onboardingComplete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === '1';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1');
}

export async function clearOnboardingFlag(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
