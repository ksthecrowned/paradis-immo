import { redirect } from 'next/navigation';

export default function AdminLoginRedirect(): never {
  redirect('/login');
}
