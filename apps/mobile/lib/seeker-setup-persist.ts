import type { SeekerSetupDraft } from '@/lib/seeker-setup';
import { updateMeAndSync } from '@/lib/users';

export async function persistSeekerSetupAndSync(
  draft: SeekerSetupDraft,
): Promise<void> {
  await updateMeAndSync({
    ...(draft.intent ? { seekerIntent: draft.intent } : {}),
    ...(draft.experience ? { seekerExperience: draft.experience } : {}),
    // Budget / quartiers are no longer collected in the wizard.
    preferredQuartierIds: [],
    completeSeekerSetup: true,
  });
}
