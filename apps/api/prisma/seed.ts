import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  GlobalRole,
  OrgMemberRole,
  OrganizationType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PropertyMode,
  PropertyStatus,
  PropertyType,
  PriceUnit,
} from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Fixed phones for local OTP login — code printed in API logs when Infobip is off. */
export const TEST_ACCOUNTS = {
  admin: { phone: '+242060000001', name: 'Admin Test', path: '/admin/dashboard' },
  agent: { phone: '+242060000002', name: 'Agent Test', path: '/agent/dashboard' },
  owner: { phone: '+242060000003', name: 'Propriétaire Test', path: '/owner/dashboard' },
  tenant: { phone: '+242060000004', name: 'Locataire Test', path: '/owner/dashboard' },
} as const;

const TEST_USER_IDS = {
  admin: 'user_test_admin',
  agent: 'user_test_agent',
  owner: 'user_test_owner',
  tenant: 'user_test_tenant',
} as const;

const PARADIS_IMMO_ID = 'org_paradis_immo';
const OWNER_ORG_ID = 'org_test_owner';
const DEMO_PROPERTY_ID = 'prop_test_demo';
const DEMO_PAYMENT_ID = 'pay_test_pending_cash';

async function syncGlobalRoles(userId: string, roles: GlobalRole[]): Promise<void> {
  await prisma.userRole.deleteMany({ where: { userId } });
  if (roles.length > 0) {
    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId, role })),
    });
  }
}

async function upsertOrgMember(
  userId: string,
  organizationId: string,
  role: OrgMemberRole,
): Promise<void> {
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId, organizationId } },
    create: { userId, organizationId, role },
    update: { role },
  });
}

async function seedTestUsers(cgId: string, quartierId: string): Promise<void> {
  await prisma.organization.upsert({
    where: { id: OWNER_ORG_ID },
    update: { name: 'Propriétaire Test' },
    create: {
      id: OWNER_ORG_ID,
      name: 'Propriétaire Test',
      type: OrganizationType.OWNER,
      countryId: cgId,
    },
  });

  const accounts: Array<{
    id: string;
    phone: string;
    name: string;
    globalRoles: GlobalRole[];
    org?: { organizationId: string; role: OrgMemberRole };
  }> = [
    {
      id: TEST_USER_IDS.admin,
      phone: TEST_ACCOUNTS.admin.phone,
      name: TEST_ACCOUNTS.admin.name,
      globalRoles: [GlobalRole.TENANT, GlobalRole.PLATFORM_ADMIN],
    },
    {
      id: TEST_USER_IDS.agent,
      phone: TEST_ACCOUNTS.agent.phone,
      name: TEST_ACCOUNTS.agent.name,
      globalRoles: [GlobalRole.TENANT],
      org: { organizationId: PARADIS_IMMO_ID, role: OrgMemberRole.AGENT },
    },
    {
      id: TEST_USER_IDS.owner,
      phone: TEST_ACCOUNTS.owner.phone,
      name: TEST_ACCOUNTS.owner.name,
      globalRoles: [GlobalRole.TENANT],
      org: { organizationId: OWNER_ORG_ID, role: OrgMemberRole.OWNER },
    },
    {
      id: TEST_USER_IDS.tenant,
      phone: TEST_ACCOUNTS.tenant.phone,
      name: TEST_ACCOUNTS.tenant.name,
      globalRoles: [GlobalRole.TENANT],
    },
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: {
        phone_countryId: { phone: account.phone, countryId: cgId },
      },
      update: { name: account.name },
      create: {
        id: account.id,
        phone: account.phone,
        countryId: cgId,
        name: account.name,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        phone_countryId: { phone: account.phone, countryId: cgId },
      },
    });
    await syncGlobalRoles(user.id, account.globalRoles);
    if (account.org) {
      await upsertOrgMember(user.id, account.org.organizationId, account.org.role);
    }
  }

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_ID },
    update: {
      title: 'Appartement démo Poto-Poto',
      status: PropertyStatus.ACTIVE,
    },
    create: {
      id: DEMO_PROPERTY_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Appartement démo Poto-Poto',
      description: 'Bien de démonstration pour les tests locaux.',
      type: PropertyType.APARTMENT,
      mode: PropertyMode.RENT_LONG,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(150000),
      currency: 'XAF',
      priceUnit: PriceUnit.MONTH,
      quartierId,
      address: '12 av. de la Paix, Poto-Poto',
      countryId: cgId,
      visitEnabled: true,
    },
  });

  await prisma.payment.upsert({
    where: { id: DEMO_PAYMENT_ID },
    update: { status: PaymentStatus.PENDING_VALIDATION },
    create: {
      id: DEMO_PAYMENT_ID,
      userId: TEST_USER_IDS.tenant,
      amount: new Prisma.Decimal(75000),
      currency: 'XAF',
      method: PaymentMethod.CASH,
      status: PaymentStatus.PENDING_VALIDATION,
      reference: 'REF-SEED-DEMO-CASH',
      idempotencyKey: 'seed-demo-cash-payment',
    },
  });

  console.log('✓ Test accounts (OTP in API logs when Infobip is off):');
  for (const [role, info] of Object.entries(TEST_ACCOUNTS)) {
    console.log(`    ${role.padEnd(8)} ${info.phone}  → ${info.path}`);
  }
}

async function main() {
  // 1. Country: Congo (CG) — XAF currency, +242 prefix
  const cg = await prisma.country.upsert({
    where: { code: 'CG' },
    update: {},
    create: {
      code: 'CG',
      name: 'Congo',
      currency: 'XAF',
      phonePrefix: '+242',
      activeProviders: ['AIRTEL'],
    },
  });
  console.log(`✓ Country: ${cg.name} (${cg.code})`);

  // 2. Brazzaville
  const bzv = await prisma.city.upsert({
    where: { name_countryId: { name: 'Brazzaville', countryId: cg.id } },
    update: {},
    create: { name: 'Brazzaville', countryId: cg.id },
  });

  const bzvArrondissements = [
    { name: 'Makélékélé', number: 1 },
    { name: 'Bacongo', number: 2 },
    { name: 'Poto-Poto', number: 3 },
    { name: 'Moungali', number: 4 },
    { name: 'Ouenzé', number: 5 },
    { name: 'Talangaï', number: 6 },
    { name: 'Mfilou', number: 7 },
    { name: 'Madibou', number: 8 },
    { name: 'Djiri', number: 9 },
  ];
  for (const a of bzvArrondissements) {
    const arr = await prisma.arrondissement.upsert({
      where: { name_cityId: { name: a.name, cityId: bzv.id } },
      update: { number: a.number },
      create: { name: a.name, number: a.number, cityId: bzv.id },
    });
    await prisma.quartier.upsert({
      where: {
        name_arrondissementId: { name: `${a.name}-Centre`, arrondissementId: arr.id },
      },
      update: {},
      create: { name: `${a.name}-Centre`, arrondissementId: arr.id },
    });
  }
  console.log(`✓ Brazzaville: ${bzvArrondissements.length} arrondissements`);

  // 3. Pointe-Noire
  const pnr = await prisma.city.upsert({
    where: { name_countryId: { name: 'Pointe-Noire', countryId: cg.id } },
    update: {},
    create: { name: 'Pointe-Noire', countryId: cg.id },
  });

  const pnrArrondissements = [
    { name: 'Lumumba', number: 1 },
    { name: 'Mvou-Mvou', number: 2 },
    { name: 'Tié-Tié', number: 3 },
    { name: 'Loandjili', number: 4 },
    { name: 'Mongo-Mpoukou', number: 5 },
    { name: 'Ngoyo', number: 6 },
  ];
  for (const a of pnrArrondissements) {
    const arr = await prisma.arrondissement.upsert({
      where: { name_cityId: { name: a.name, cityId: pnr.id } },
      update: { number: a.number },
      create: { name: a.name, number: a.number, cityId: pnr.id },
    });
    await prisma.quartier.upsert({
      where: {
        name_arrondissementId: { name: `${a.name}-Centre`, arrondissementId: arr.id },
      },
      update: {},
      create: { name: `${a.name}-Centre`, arrondissementId: arr.id },
    });
  }
  console.log(`✓ Pointe-Noire: ${pnrArrondissements.length} arrondissements`);

  // 4. Paradis Immo platform organization (AGENCY type, APPROVED)
  const paradis = await prisma.organization.upsert({
    where: { id: 'org_paradis_immo' },
    update: {},
    create: {
      id: 'org_paradis_immo',
      name: 'Paradis Immo',
      type: 'AGENCY',
      affiliationStatus: 'APPROVED',
      countryId: cg.id,
    },
  });
  console.log(`✓ Organization: ${paradis.name} (${paradis.id})`);

  const demoQuartier = await prisma.quartier.findFirst({
    where: {
      name: 'Poto-Poto-Centre',
      arrondissement: { cityId: bzv.id },
    },
  });
  if (!demoQuartier) {
    throw new Error('Poto-Poto-Centre quartier missing after seed');
  }
  await seedTestUsers(cg.id, demoQuartier.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });