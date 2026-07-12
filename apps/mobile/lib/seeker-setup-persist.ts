import type { SeekerSetupDraft } from '@/lib/seeker-setup';
import { updateMeAndSync } from '@/lib/users';

export async function persistSeekerSetupAndSync(
  draft: SeekerSetupDraft,
): Promise<void> {
  await updateMeAndSync({
    ...(draft.intent ? { seekerIntent: draft.intent } : {}),
    ...(draft.experience ? { seekerExperience: draft.experience } : {}),
    ...(draft.budgetMinXaf != null ? { budgetMinXaf: draft.budgetMinXaf } : {}),
    ...(draft.budgetMaxXaf != null ? { budgetMaxXaf: draft.budgetMaxXaf } : {}),
    preferredQuartierIds: draft.preferredQuartierIds,
    completeSeekerSetup: true,
  });
}
