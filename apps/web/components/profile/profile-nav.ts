import { DASH_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';

export type ProfileTab = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

export const PROFILE_TABS: ProfileTab[] = [
  {
    href: ROUTES.profile.account,
    icon: DASH_ICONS.user,
    title: 'Compte',
    description: 'Gérer vos informations personnelles',
  },
  {
    href: ROUTES.profile.security,
    icon: DASH_ICONS.shield,
    title: 'Sécurité',
    description: 'Mot de passe, sessions et suppression',
  },
  {
    href: ROUTES.profile.notifications,
    icon: DASH_ICONS.bell,
    title: 'Notifications',
    description: 'Choisir comment vous êtes alerté',
  },
];
