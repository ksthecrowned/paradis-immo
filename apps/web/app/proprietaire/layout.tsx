'use client';

/**
 * Layout `/proprietaire/*` — propriétaire authentifié.
 *
 * Sidebar de navigation entre les sections. Le contenu de chaque
 * section vit dans sa propre page ; le layout se contente d'enrober
 * + afficher la nav.
 *
 * Pas de garde d'auth côté serveur (le projet est en Client
 * Components partout). Chaque page responsable de rediriger
 * vers /login si besoin.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  /** Match exact uniquement (utile pour le dashboard). */
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: '/proprietaire/dashboard', label: 'Tableau de bord', exact: true },
  { href: '/proprietaire/biens', label: 'Biens' },
  { href: '/proprietaire/visites', label: 'Visites' },
  { href: '/proprietaire/baux', label: 'Baux' },
  { href: '/proprietaire/paiements', label: 'Paiements' },
  { href: '/proprietaire/maintenance', label: 'Maintenance' },
  { href: '/proprietaire/mandat', label: 'Mon mandat' },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname() ?? '';
  return (
    <div className="flex flex-1 flex-col bg-gray-50 dark:bg-neutral-900">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:w-60 lg:shrink-0">
          <nav
            aria-label="Navigation propriétaire"
            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
          >
            <ul className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={
                        'block rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
                        (active
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-700')
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => {
                logout();
                if (typeof window !== 'undefined') {
                  window.location.href = '/login';
                }
              }}
              className="mt-3 hidden w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-700 lg:block"
            >
              Se déconnecter
            </button>
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
