import { apiFetch } from '@/lib/api';
import { getInstallId } from '@/lib/device-id';

/**
 * Fire-and-forget view recording. Never throws; never blocks the UI.
 * Sends JWT when available and always includes deviceId as fallback.
 */
export async function recordPropertyView(propertyId: string): Promise<void> {
  try {
    const deviceId = await getInstallId();
    await apiFetch<{ counted: boolean }>(`/properties/${propertyId}/views`, {
      method: 'POST',
      body: { deviceId },
    });
  } catch {
    // Silent — view counting must not affect browsing.
  }
}
