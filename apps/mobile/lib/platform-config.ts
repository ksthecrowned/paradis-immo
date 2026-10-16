import { apiFetch } from '@/lib/api';

export interface PlatformVersionPolicy {
  minVersion: string;
  latestVersion: string;
  storeUrl: string | null;
  message: string | null;
}

export interface MobileAppConfig {
  announcements: Array<{
    title: string;
    body: string;
    audience: string;
    startsAt: string;
    endsAt: string | null;
  }>;
  versions: Partial<Record<'ios' | 'android', PlatformVersionPolicy>>;
  featureFlags: Record<string, boolean>;
}

export async function fetchMobileAppConfig(): Promise<MobileAppConfig> {
  return apiFetch<MobileAppConfig>('/app/config', { anonymous: true });
}
