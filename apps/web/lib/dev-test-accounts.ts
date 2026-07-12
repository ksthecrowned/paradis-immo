/**
 * Dev-only test accounts — must stay in sync with `apps/api/prisma/seed.ts`.
 * Admins use `/admin/login` (email/password), not phone OTP.
 */
export const DEV_TEST_ACCOUNTS = [
  {
    role: 'Admin',
    phone: '—',
    email: 'admin@paradisimmo.cg',
    path: '/admin/login',
  },
  { role: 'Agent', phone: '+242060000002', path: '/agent/dashboard' },
  { role: 'Propriétaire', phone: '+242060000003', path: '/owner/dashboard' },
  { role: 'Locataire', phone: '+242060000004', path: '—' },
] as const;
