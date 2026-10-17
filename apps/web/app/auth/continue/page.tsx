import { auth } from '@/auth';
import { getApiErrorCode } from '@/lib/api-error-code';
import { ACCOUNT_CANCEL_DELETION_PATH, getMe } from '@/lib/me';
import { resolveDashboardPath, isWebAccountActive } from '@/lib/web-account';
import { redirect } from 'next/navigation';

/**
 * Post-login landing: send the user to their dashboard or role onboarding.
 * Avoids hardcoding `/onboarding/role` on Google / magic / password flows.
 * A DELETED account (recovery window) is sent to cancel-deletion.
 */
export default async function AuthContinuePage(): Promise<never> {
  const session = await auth();
  if (!session?.user || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }
  if (!isWebAccountActive(session.user)) {
    redirect('/onboarding/role');
  }

  try {
    await getMe();
  } catch (err) {
    if (getApiErrorCode(err) === 'ACCOUNT_DELETED') {
      redirect(ACCOUNT_CANCEL_DELETION_PATH);
    }
  }

  redirect(resolveDashboardPath(session.user));
}
