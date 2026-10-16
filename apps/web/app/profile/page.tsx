import { ROUTES } from '@/lib/routes';
import { redirect } from 'next/navigation';

export default function ProfileIndexPage(): never {
  redirect(ROUTES.profile.account);
}
