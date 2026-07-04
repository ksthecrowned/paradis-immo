/**
 * Dev-only test account phones — must stay in sync with `apps/api/prisma/seed.ts`.
 */
export const DEV_TEST_ACCOUNTS = [
  { role: 'Admin', phone: '+242060000001', path: '/admin/dashboard' },
  { role: 'Agent', phone: '+242060000002', path: '/agent/dashboard' },
  { role: 'Propriétaire', phone: '+242060000003', path: '/owner/dashboard' },
  { role: 'Locataire', phone: '+242060000004', path: '—' },
] as const;
