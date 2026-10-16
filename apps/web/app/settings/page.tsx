import { ROUTES } from '@/lib/routes';
import { redirect } from 'next/navigation';

/** Legacy menu entry — redirect to profile security. */
export default function SettingsRedirectPage(): never {
  redirect(ROUTES.profile.security);
}
