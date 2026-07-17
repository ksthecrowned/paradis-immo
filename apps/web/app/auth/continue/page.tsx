import { auth } from '@/auth';
import { resolveDashboardPath, isWebAccountActive } from '@/lib/web-account';
import { redirect } from 'next/navigation';

/**
 * Post-login landing: send the user to their dashboard or role onboarding.
 * Avoids hardcoding `/onboarding/role` on Google / magic / password flows.
 */
export default async function AuthContinuePage(): Promise<never> {
  const session = await auth();
  if (!session?.user || session.error === 'RefreshAccessTokenError') {
    redirect('/login');
  }
  if (!isWebAccountActive(session.user)) {
    redirect('/onboarding/role');
  }
  redirect(resolveDashboardPath(session.user));
}
