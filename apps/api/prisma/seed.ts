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
  MediaType,
  SaleInquiryStatus,
  VisitSlotSource,
  VisitSlotStatus,
  VisitType,
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
const DEMO_PROPERTY_SALE_ID = 'prop_test_sale';
const DEMO_PROPERTY_SHORT_ID = 'prop_test_short';
const DEMO_MEDIA_ID = 'media_test_demo_1';
const DEMO_SALE_INQUIRY_ID = 'inquiry_test_sale_1';
const DEMO_PAYMENT_ID = 'pay_test_pending_cash';

/** Public image URL for demo gallery (no R2 required). */
const DEMO_PHOTO_URL =
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80';

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
      visitType: VisitType.FREE,
      visitEnabled: true,
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
      visitType: VisitType.FREE,
      bedrooms: 3,
      bathrooms: 2,
      surface: 85,
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_SALE_ID },
    update: { status: PropertyStatus.ACTIVE },
    create: {
      id: DEMO_PROPERTY_SALE_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Villa à vendre Bacongo',
      description: 'Maison familiale avec jardin — démo vente.',
      type: PropertyType.HOUSE,
      mode: PropertyMode.SALE,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(45000000),
      currency: 'XAF',
      priceUnit: PriceUnit.TOTAL,
      quartierId,
      address: '8 rue des Manguiers, Bacongo',
      countryId: cgId,
      visitEnabled: true,
      bedrooms: 4,
      bathrooms: 3,
      surface: 220,
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_SHORT_ID },
    update: { status: PropertyStatus.ACTIVE },
    create: {
      id: DEMO_PROPERTY_SHORT_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Studio courte durée Moungali',
      description: 'Location meublée à la nuit — démo RENT_SHORT.',
      type: PropertyType.APARTMENT,
      mode: PropertyMode.RENT_SHORT,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(35000),
      currency: 'XAF',
      priceUnit: PriceUnit.NIGHT,
      quartierId,
      address: '5 av. Matsoua, Moungali',
      countryId: cgId,
      visitEnabled: false,
      bedrooms: 1,
      bathrooms: 1,
      surface: 42,
    },
  });

  await prisma.propertyMedia.upsert({
    where: { id: DEMO_MEDIA_ID },
    update: { url: DEMO_PHOTO_URL },
    create: {
      id: DEMO_MEDIA_ID,
      propertyId: DEMO_PROPERTY_ID,
      type: MediaType.PHOTO,
      url: DEMO_PHOTO_URL,
      position: 0,
    },
  });

  await prisma.saleInquiry.upsert({
    where: { id: DEMO_SALE_INQUIRY_ID },
    update: { status: SaleInquiryStatus.NEW },
    create: {
      id: DEMO_SALE_INQUIRY_ID,
      propertyId: DEMO_PROPERTY_SALE_ID,
      userId: TEST_USER_IDS.tenant,
      message: 'Intéressé par une visite cette semaine.',
      status: SaleInquiryStatus.NEW,
    },
  });

  // Demo visit slots — next 5 weekdays at 10:00 and 14:00
  const slotBase = new Date();
  slotBase.setHours(0, 0, 0, 0);
  let slotIndex = 0;
  for (let day = 1; day <= 7 && slotIndex < 10; day += 1) {
    const date = new Date(slotBase);
    date.setDate(date.getDate() + day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    for (const hour of [10, 14]) {
      const startAt = new Date(date);
      startAt.setHours(hour, 0, 0, 0);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + 45);
      const slotId = `slot_test_demo_${slotIndex}`;
      await prisma.visitSlot.upsert({
        where: { id: slotId },
        update: {
          status: VisitSlotStatus.AVAILABLE,
          startAt,
          endAt,
        },
        create: {
          id: slotId,
          propertyId: DEMO_PROPERTY_ID,
          startAt,
          endAt,
          status: VisitSlotStatus.AVAILABLE,
          source: VisitSlotSource.MANUAL,
        },
      });
      slotIndex += 1;
    }
  }

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
  console.log('✓ Demo properties:');
  console.log(`    ${DEMO_PROPERTY_ID}  RENT_LONG  (visites activées, créneaux seed)`);
  console.log(`    ${DEMO_PROPERTY_SALE_ID}  SALE`);
  console.log(`    ${DEMO_PROPERTY_SHORT_ID}  RENT_SHORT`);
  console.log(`    ${DEMO_SALE_INQUIRY_ID}  sale inquiry (NEW)`);
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