import { PrismaPg } from '@prisma/adapter-pg';
import {
  AffiliationStatus,
  GlobalRole,
  ListingStatus,
  MediaType,
  MandateStatus,
  OrgMemberRole,
  OrganizationType,
  PaymentMethod,
  PaymentStatus,
  PriceUnit,
  Prisma,
  PrismaClient,
  PropertyMode,
  PropertyStatus,
  PropertyType,
  SaleInquiryStatus,
  VisitSlotSource,
  VisitSlotStatus,
  VisitType,
} from '@prisma/client';
import 'dotenv/config';
import { hashPassword } from '../src/auth/password.util';
import { SEED_IDS } from './seed-ids';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_SEED_EMAIL =
  process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase() ||
  'admin@paradisimmo.cg';
const ADMIN_SEED_PASSWORD =
  process.env.ADMIN_SEED_PASSWORD?.trim() || 'Admin123!';

/** Fixed phones for local OTP login — code printed in API logs when Infobip is off. */
export const TEST_ACCOUNTS = {
  admin: {
    phone: '+242060000001',
    email: ADMIN_SEED_EMAIL,
    password: ADMIN_SEED_PASSWORD,
    name: 'Admin Test',
    path: '/admin/dashboard',
  },
  manager: {
    phone: '+242060000008',
    email: 'manager@paradisimmo.cg',
    password: 'Manager123!',
    name: 'Gérant Paradis',
    path: '/agent/dashboard',
  },
  agent: {
    phone: '+242060000002',
    name: 'Agent Test',
    path: '/agent/dashboard',
  },
  owner: {
    phone: '+242060000003',
    name: 'Propriétaire Test',
    path: '/owner/dashboard',
  },
  tenant: {
    phone: '+242060000004',
    name: 'Locataire Test',
    path: '/owner/dashboard',
  },
} as const;

const TEST_USER_IDS = {
  admin: SEED_IDS.userAdmin,
  agent: SEED_IDS.userAgent,
  owner: SEED_IDS.userOwner,
  tenant: SEED_IDS.userTenant,
} as const;

const PARADIS_IMMO_ID = SEED_IDS.orgParadisImmo;
const OWNER_ORG_ID = SEED_IDS.orgOwner;
const DEMO_PROPERTY_ID = SEED_IDS.propRentLong;
const DEMO_PROPERTY_SALE_ID = SEED_IDS.propSale;
const DEMO_PROPERTY_SHORT_ID = SEED_IDS.propShort;
const DEMO_PROPERTY_LAND_ID = SEED_IDS.propLand;
const DEMO_PROPERTY_UNDER_OFFER_ID = SEED_IDS.propUnderOffer;
const DEMO_PROPERTY_RENT_SOON_ID = SEED_IDS.propRentSoon;
const DEMO_SALE_INQUIRY_ID = SEED_IDS.saleInquiry;
const DEMO_PAYMENT_ID = SEED_IDS.paymentCash;

/** Stable R2 keys from `bun run seed:upload-images`. */
function seedHouseUrl(n: 1 | 2 | 3 | 4 | 5 | 6): string {
  const base = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
  if (!base) {
    throw new Error(
      'R2_PUBLIC_URL is required for seed media. Run seed:upload-images first.',
    );
  }
  return `${base}/seed/houses/house${n}.jpg`;
}

async function upsertPropertyMedia(
  propertyId: string,
  mediaIds: readonly string[],
  houseNumbers: Array<1 | 2 | 3 | 4 | 5 | 6>,
): Promise<void> {
  for (let i = 0; i < houseNumbers.length; i += 1) {
    const n = houseNumbers[i];
    const id = mediaIds[i];
    if (!id) {
      throw new Error(`Missing media UUID for ${propertyId} index ${i}`);
    }
    await prisma.propertyMedia.upsert({
      where: { id },
      update: {
        url: seedHouseUrl(n),
        type: MediaType.PHOTO,
        position: i,
        propertyId,
      },
      create: {
        id,
        propertyId,
        type: MediaType.PHOTO,
        url: seedHouseUrl(n),
        position: i,
      },
    });
  }
}

async function syncGlobalRoles(
  userId: string,
  roles: GlobalRole[],
): Promise<void> {
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

async function seedPartnerAgencies(cgId: string): Promise<void> {
  await prisma.organization.upsert({
    where: { id: SEED_IDS.orgCoteSauvage },
    update: {
      name: 'Agence Côte Sauvage',
      shortName: 'Côte Sauvage',
      tagline: 'Villas et locations en bord de mer',
      address: 'Av. de la Côte, Loandjili',
      phone: '+242 06 500 11 22',
      cityLabel: 'Pointe-Noire',
      logoColor: '#0F766E',
      isOfficial: false,
      verified: true,
      foundedYear: 2014,
      rating: 4.6,
      reviewCount: 42,
      dealSuccessPercent: 88,
      type: OrganizationType.AGENCY,
      affiliationStatus: AffiliationStatus.APPROVED,
    },
    create: {
      id: SEED_IDS.orgCoteSauvage,
      name: 'Agence Côte Sauvage',
      shortName: 'Côte Sauvage',
      tagline: 'Villas et locations en bord de mer',
      address: 'Av. de la Côte, Loandjili',
      phone: '+242 06 500 11 22',
      cityLabel: 'Pointe-Noire',
      logoColor: '#0F766E',
      isOfficial: false,
      verified: true,
      foundedYear: 2014,
      rating: 4.6,
      reviewCount: 42,
      dealSuccessPercent: 88,
      type: OrganizationType.AGENCY,
      affiliationStatus: AffiliationStatus.APPROVED,
      countryId: cgId,
    },
  });

  await prisma.organization.upsert({
    where: { id: SEED_IDS.orgHabitatPn },
    update: {
      name: 'Habitat Pointe-Noire',
      shortName: 'Habitat PN',
      tagline: 'Appartements et bureaux au centre-ville',
      address: 'Bd. Général de Gaulle, Centre-ville',
      phone: '+242 06 500 33 44',
      cityLabel: 'Pointe-Noire',
      logoColor: '#B45309',
      isOfficial: false,
      verified: true,
      foundedYear: 2018,
      rating: 4.4,
      reviewCount: 31,
      dealSuccessPercent: 82,
      type: OrganizationType.AGENCY,
      affiliationStatus: AffiliationStatus.APPROVED,
    },
    create: {
      id: SEED_IDS.orgHabitatPn,
      name: 'Habitat Pointe-Noire',
      shortName: 'Habitat PN',
      tagline: 'Appartements et bureaux au centre-ville',
      address: 'Bd. Général de Gaulle, Centre-ville',
      phone: '+242 06 500 33 44',
      cityLabel: 'Pointe-Noire',
      logoColor: '#B45309',
      isOfficial: false,
      verified: true,
      foundedYear: 2018,
      rating: 4.4,
      reviewCount: 31,
      dealSuccessPercent: 82,
      type: OrganizationType.AGENCY,
      affiliationStatus: AffiliationStatus.APPROVED,
      countryId: cgId,
    },
  });

  console.log('✓ Partner agencies: Côte Sauvage, Habitat Pointe-Noire');
}

/** One-shot cleanup when migrating seed IDs from string slugs → UUIDs. */
async function purgeLegacySeedArtifacts(): Promise<void> {
  const legacyPropertyIds = [
    'prop_test_demo',
    'prop_test_sale',
    'prop_test_short',
    'prop_test_land',
  ];
  const legacyUserIds = [
    'user_test_admin',
    'user_test_agent',
    'user_test_owner',
    'user_test_tenant',
  ];
  const legacyOrgIds = ['org_paradis_immo', 'org_test_owner'];
  const legacyMediaIds = ['media_test_demo_1'];
  const legacyInquiryIds = ['inquiry_test_sale_1'];
  const legacyPaymentIds = ['pay_test_pending_cash'];
  const legacySlotIds = Array.from(
    { length: 10 },
    (_, i) => `slot_test_demo_${i}`,
  );

  await prisma.paymentAllocation.deleteMany({
    where: { paymentId: { in: legacyPaymentIds } },
  });
  await prisma.receipt.deleteMany({
    where: { paymentId: { in: legacyPaymentIds } },
  });
  await prisma.payment.deleteMany({
    where: {
      OR: [{ id: { in: legacyPaymentIds } }, { userId: { in: legacyUserIds } }],
    },
  });
  await prisma.saleInquiry.deleteMany({
    where: {
      OR: [
        { id: { in: legacyInquiryIds } },
        { propertyId: { in: legacyPropertyIds } },
        { userId: { in: legacyUserIds } },
      ],
    },
  });
  await prisma.maintenanceTicket.deleteMany({
    where: { propertyId: { in: legacyPropertyIds } },
  });
  await prisma.rentSchedule.deleteMany({
    where: { lease: { propertyId: { in: legacyPropertyIds } } },
  });
  await prisma.lease.deleteMany({
    where: {
      OR: [
        { propertyId: { in: legacyPropertyIds } },
        { tenantId: { in: legacyUserIds } },
      ],
    },
  });
  await prisma.mandateApproval.deleteMany({
    where: { mandate: { propertyId: { in: legacyPropertyIds } } },
  });
  await prisma.mandate.deleteMany({
    where: { propertyId: { in: legacyPropertyIds } },
  });
  await prisma.booking.deleteMany({
    where: {
      OR: [
        { propertyId: { in: legacyPropertyIds } },
        { userId: { in: legacyUserIds } },
      ],
    },
  });
  await prisma.visitBooking.deleteMany({
    where: {
      OR: [
        { propertyId: { in: legacyPropertyIds } },
        { userId: { in: legacyUserIds } },
      ],
    },
  });
  await prisma.visitSlot.deleteMany({
    where: {
      OR: [
        { id: { in: legacySlotIds } },
        { propertyId: { in: legacyPropertyIds } },
      ],
    },
  });
  await prisma.visitSlotTemplate.deleteMany({
    where: { propertyId: { in: legacyPropertyIds } },
  });
  await prisma.availabilityBlock.deleteMany({
    where: { propertyId: { in: legacyPropertyIds } },
  });
  await prisma.favorite.deleteMany({
    where: {
      OR: [
        { propertyId: { in: legacyPropertyIds } },
        { userId: { in: legacyUserIds } },
      ],
    },
  });
  await prisma.propertyDocument.deleteMany({
    where: { propertyId: { in: legacyPropertyIds } },
  });
  await prisma.propertyMedia.deleteMany({
    where: {
      OR: [
        { id: { in: legacyMediaIds } },
        { propertyId: { in: legacyPropertyIds } },
      ],
    },
  });
  await prisma.property.deleteMany({
    where: {
      OR: [
        { id: { in: legacyPropertyIds } },
        { ownerId: { in: legacyUserIds } },
        { organizationId: { in: legacyOrgIds } },
      ],
    },
  });
  await prisma.notification.deleteMany({
    where: { userId: { in: legacyUserIds } },
  });
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: legacyUserIds } },
  });
  await prisma.organizationMember.deleteMany({
    where: {
      OR: [
        { userId: { in: legacyUserIds } },
        { organizationId: { in: legacyOrgIds } },
      ],
    },
  });
  await prisma.userRole.deleteMany({
    where: { userId: { in: legacyUserIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: legacyUserIds } } });
  await prisma.organization.deleteMany({
    where: { id: { in: legacyOrgIds } },
  });
}

async function seedTestUsers(
  cgId: string,
  quartiers: {
    centreVille: string;
    loandjili: string;
    tieTie: string;
    mongo: string;
  },
): Promise<void> {
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
    email?: string;
    password?: string;
    globalRoles: GlobalRole[];
    org?: { organizationId: string; role: OrgMemberRole };
  }> = [
    {
      id: TEST_USER_IDS.admin,
      phone: TEST_ACCOUNTS.admin.phone,
      name: TEST_ACCOUNTS.admin.name,
      email: TEST_ACCOUNTS.admin.email,
      password: TEST_ACCOUNTS.admin.password,
      globalRoles: [GlobalRole.TENANT, GlobalRole.PLATFORM_ADMIN],
    },
    {
      id: TEST_USER_IDS.agent,
      phone: TEST_ACCOUNTS.agent.phone,
      name: TEST_ACCOUNTS.agent.name,
      email: 'agent@paradisimmo.cg',
      password: 'Agent123!',
      globalRoles: [GlobalRole.TENANT],
      org: { organizationId: PARADIS_IMMO_ID, role: OrgMemberRole.AGENT },
    },
    {
      id: SEED_IDS.userManager,
      phone: TEST_ACCOUNTS.manager.phone,
      name: TEST_ACCOUNTS.manager.name,
      email: TEST_ACCOUNTS.manager.email,
      password: TEST_ACCOUNTS.manager.password,
      globalRoles: [GlobalRole.TENANT],
      org: { organizationId: PARADIS_IMMO_ID, role: OrgMemberRole.ADMIN },
    },
    {
      id: SEED_IDS.userAgentParadis2,
      phone: '+242060000005',
      name: 'Claire Mouanda',
      globalRoles: [GlobalRole.TENANT],
      org: { organizationId: PARADIS_IMMO_ID, role: OrgMemberRole.AGENT },
    },
    {
      id: SEED_IDS.userAgentCote,
      phone: '+242060000006',
      name: 'Grace Mabiala',
      globalRoles: [GlobalRole.TENANT],
      org: {
        organizationId: SEED_IDS.orgCoteSauvage,
        role: OrgMemberRole.AGENT,
      },
    },
    {
      id: SEED_IDS.userAgentHabitat,
      phone: '+242060000007',
      name: 'Amina Nguimbi',
      globalRoles: [GlobalRole.TENANT],
      org: {
        organizationId: SEED_IDS.orgHabitatPn,
        role: OrgMemberRole.AGENT,
      },
    },
    {
      id: TEST_USER_IDS.owner,
      phone: TEST_ACCOUNTS.owner.phone,
      name: TEST_ACCOUNTS.owner.name,
      email: 'owner@paradisimmo.cg',
      password: 'Owner123!',
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
    const passwordHash = account.password
      ? await hashPassword(account.password)
      : undefined;
    await prisma.user.upsert({
      where: { id: account.id },
      update: {
        name: account.name,
        phone: account.phone,
        countryId: cgId,
        ...(account.email ? { email: account.email } : {}),
        ...(passwordHash
          ? { passwordHash, emailVerifiedAt: new Date() }
          : {}),
      },
      create: {
        id: account.id,
        phone: account.phone,
        countryId: cgId,
        name: account.name,
        email: account.email,
        passwordHash,
        emailVerifiedAt: passwordHash ? new Date() : undefined,
      },
    });

    await syncGlobalRoles(account.id, account.globalRoles);
    if (account.org) {
      await upsertOrgMember(
        account.id,
        account.org.organizationId,
        account.org.role,
      );
    }
  }

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_ID },
    update: {
      title: 'Appartement Centre-ville',
      description:
        'Appartement meublé au 2e étage en plein centre-ville de Pointe-Noire, proche des commerces et des services. Séjour confortable, cuisine fonctionnelle et balcon avec vue sur la rue.\n\nParfait pour une location longue durée : wifi, climatisation, chauffe-eau et eau courante.',
      status: PropertyStatus.ACTIVE,
      visitType: VisitType.FREE,
      visitEnabled: true,
      quartierId: quartiers.centreVille,
      address: 'Avenue du Général de Gaulle, Centre-ville',
      lat: -4.7698,
      lng: 11.8665,
      price: new Prisma.Decimal(100000),
      bedrooms: 3,
      bathrooms: 1,
      surface: 95,
      listingStatus: ListingStatus.OCCUPIED,
      availableFrom: null,
      isFeatured: false,
      floor: '2e étage',
      yearBuilt: 2012,
      condition: 'Bon état',
      parkingSpaces: 1,
      orientation: 'Est',
      landTitle: 'Bail emphytéotique',
      features: [
        'cuisine',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'meuble',
        'balcon',
        'securite',
        'eau_courante',
        'parking',
      ],
      mapViews: ['neighborhood', 'streetView'],
    },
    create: {
      id: DEMO_PROPERTY_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Appartement Centre-ville',
      description:
        'Appartement meublé au 2e étage en plein centre-ville de Pointe-Noire, proche des commerces et des services.',
      type: PropertyType.APARTMENT,
      mode: PropertyMode.RENT_LONG,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(100000),
      currency: 'XAF',
      priceUnit: PriceUnit.MONTH,
      quartierId: quartiers.centreVille,
      address: 'Avenue du Général de Gaulle, Centre-ville',
      lat: -4.7698,
      lng: 11.8665,
      countryId: cgId,
      visitEnabled: true,
      visitType: VisitType.FREE,
      bedrooms: 3,
      bathrooms: 1,
      surface: 95,
      listingStatus: ListingStatus.OCCUPIED,
      availableFrom: null,
      isFeatured: false,
      floor: '2e étage',
      yearBuilt: 2012,
      condition: 'Bon état',
      parkingSpaces: 1,
      orientation: 'Est',
      landTitle: 'Bail emphytéotique',
      features: [
        'cuisine',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'meuble',
        'balcon',
        'securite',
        'eau_courante',
        'parking',
      ],
      mapViews: ['neighborhood', 'streetView'],
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_SALE_ID },
    update: {
      title: 'Villa Whispering Pines',
      description:
        'Belle villa R+1 située à Loandjili, dans un quartier calme et résidentiel de Pointe-Noire. La maison offre de beaux volumes, une cuisine équipée, un salon lumineux et un jardin arboré avec parking sécurisé.',
      status: PropertyStatus.ACTIVE,
      visitType: VisitType.PAID,
      visitPrice: new Prisma.Decimal(5000),
      visitEnabled: true,
      visitDuration: 45,
      quartierId: quartiers.loandjili,
      address: 'Loandjili, Pointe-Noire',
      lat: -4.7825,
      lng: 11.8582,
      price: new Prisma.Decimal(70000000),
      bedrooms: 4,
      bathrooms: 2,
      surface: 180,
      listingStatus: ListingStatus.AVAILABLE,
      availableFrom: null,
      isFeatured: false,
      floor: 'R+1',
      yearBuilt: 2018,
      condition: 'Très bon état',
      lotSize: 450,
      parkingSpaces: 2,
      orientation: 'Sud-Ouest',
      landTitle: 'Titre foncier',
      features: [
        'cuisine',
        'debarras',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'parking',
        'jardin',
        'securite',
        'groupe_electrogene',
        'terrasse',
        'eau_courante',
      ],
      mapViews: ['neighborhood', 'streetView', 'tour360'],
    },
    create: {
      id: DEMO_PROPERTY_SALE_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Villa Whispering Pines',
      description:
        'Belle villa R+1 située à Loandjili, dans un quartier calme et résidentiel de Pointe-Noire.',
      type: PropertyType.HOUSE,
      mode: PropertyMode.SALE,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(70000000),
      currency: 'XAF',
      priceUnit: PriceUnit.TOTAL,
      quartierId: quartiers.loandjili,
      address: 'Loandjili, Pointe-Noire',
      lat: -4.7825,
      lng: 11.8582,
      countryId: cgId,
      visitEnabled: true,
      visitType: VisitType.PAID,
      visitPrice: new Prisma.Decimal(5000),
      visitDuration: 45,
      bedrooms: 4,
      bathrooms: 2,
      surface: 180,
      listingStatus: ListingStatus.AVAILABLE,
      availableFrom: null,
      isFeatured: false,
      floor: 'R+1',
      yearBuilt: 2018,
      condition: 'Très bon état',
      lotSize: 450,
      parkingSpaces: 2,
      orientation: 'Sud-Ouest',
      landTitle: 'Titre foncier',
      features: [
        'cuisine',
        'debarras',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'parking',
        'jardin',
        'securite',
        'groupe_electrogene',
        'terrasse',
        'eau_courante',
      ],
      mapViews: ['neighborhood', 'streetView', 'tour360'],
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_SHORT_ID },
    update: {
      title: 'Maison Tié-Tié',
      description:
        'Maison cosy à Tié-Tié, proposée en location journalière pour vos séjours à Pointe-Noire. Espace de vie agréable, cuisine équipée, wifi et climatisation.',
      status: PropertyStatus.ACTIVE,
      quartierId: quartiers.tieTie,
      address: 'Tié-Tié, Pointe-Noire',
      lat: -4.8012,
      lng: 11.8748,
      price: new Prisma.Decimal(45000),
      bedrooms: 3,
      bathrooms: 2,
      surface: 120,
      listingStatus: ListingStatus.AVAILABLE,
      availableFrom: null,
      isFeatured: true,
      floor: 'RDC',
      yearBuilt: 2015,
      condition: 'Bon état',
      lotSize: 300,
      parkingSpaces: 2,
      orientation: 'Nord',
      landTitle: 'Titre foncier',
      features: [
        'cuisine',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'meuble',
        'jardin',
        'terrasse',
        'parking',
        'groupe_electrogene',
        'eau_courante',
      ],
      mapViews: ['neighborhood', 'tour360'],
    },
    create: {
      id: DEMO_PROPERTY_SHORT_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Maison Tié-Tié',
      description:
        'Maison cosy à Tié-Tié, proposée en location journalière pour vos séjours à Pointe-Noire.',
      type: PropertyType.HOUSE,
      mode: PropertyMode.RENT_SHORT,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(45000),
      currency: 'XAF',
      priceUnit: PriceUnit.NIGHT,
      quartierId: quartiers.tieTie,
      address: 'Tié-Tié, Pointe-Noire',
      lat: -4.8012,
      lng: 11.8748,
      countryId: cgId,
      visitEnabled: false,
      bedrooms: 3,
      bathrooms: 2,
      surface: 120,
      listingStatus: ListingStatus.AVAILABLE,
      availableFrom: null,
      isFeatured: true,
      floor: 'RDC',
      yearBuilt: 2015,
      condition: 'Bon état',
      lotSize: 300,
      parkingSpaces: 2,
      orientation: 'Nord',
      landTitle: 'Titre foncier',
      features: [
        'cuisine',
        'climatisation',
        'chauffe_eau',
        'wifi',
        'meuble',
        'jardin',
        'terrasse',
        'parking',
        'groupe_electrogene',
        'eau_courante',
      ],
      mapViews: ['neighborhood', 'tour360'],
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_LAND_ID },
    update: {
      title: 'Terrain Mongo-Poukou',
      description:
        'Terrain constructible de 400 m² à Mongo-Mpoukou, dans un secteur en développement de Pointe-Noire.',
      status: PropertyStatus.ACTIVE,
      quartierId: quartiers.mongo,
      address: 'Mongo-Mpoukou, Pointe-Noire',
      lat: -4.7585,
      lng: 11.849,
      price: new Prisma.Decimal(12000000),
      surface: 400,
      listingStatus: ListingStatus.SOLD,
      availableFrom: null,
      isFeatured: false,
      condition: 'Terrain nu',
      lotSize: 400,
      landTitle: 'Attestation de détention coutumière',
      features: ['parking', 'eau_courante'],
      mapViews: ['neighborhood'],
    },
    create: {
      id: DEMO_PROPERTY_LAND_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Terrain Mongo-Poukou',
      description:
        'Terrain constructible de 400 m² à Mongo-Mpoukou, dans un secteur en développement de Pointe-Noire.',
      type: PropertyType.LAND,
      mode: PropertyMode.SALE,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(12000000),
      currency: 'XAF',
      priceUnit: PriceUnit.TOTAL,
      quartierId: quartiers.mongo,
      address: 'Mongo-Mpoukou, Pointe-Noire',
      lat: -4.7585,
      lng: 11.849,
      countryId: cgId,
      visitEnabled: true,
      surface: 400,
      listingStatus: ListingStatus.SOLD,
      availableFrom: null,
      isFeatured: false,
      condition: 'Terrain nu',
      lotSize: 400,
      landTitle: 'Attestation de détention coutumière',
      features: ['parking', 'eau_courante'],
      mapViews: ['neighborhood'],
    },
  });

  const availableFromSoon = new Date();
  availableFromSoon.setDate(availableFromSoon.getDate() + 12);
  availableFromSoon.setHours(0, 0, 0, 0);

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_UNDER_OFFER_ID },
    update: {
      title: 'Duplex Mpaka',
      description:
        'Duplex contemporain à Mpaka, actuellement sous offre. Volumes généreux, terrasse et parking sécurisé.',
      status: PropertyStatus.ACTIVE,
      quartierId: quartiers.loandjili,
      address: 'Mpaka, Pointe-Noire',
      lat: -4.7901,
      lng: 11.862,
      price: new Prisma.Decimal(45000000),
      bedrooms: 3,
      bathrooms: 2,
      surface: 140,
      listingStatus: ListingStatus.UNDER_OFFER,
      availableFrom: null,
      isFeatured: false,
      floor: 'R+1',
      yearBuilt: 2016,
      condition: 'Bon état',
      parkingSpaces: 1,
      features: [
        'cuisine',
        'climatisation',
        'wifi',
        'terrasse',
        'parking',
        'securite',
        'eau_courante',
      ],
      mapViews: ['neighborhood'],
    },
    create: {
      id: DEMO_PROPERTY_UNDER_OFFER_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Duplex Mpaka',
      description:
        'Duplex contemporain à Mpaka, actuellement sous offre. Volumes généreux, terrasse et parking sécurisé.',
      type: PropertyType.HOUSE,
      mode: PropertyMode.SALE,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(45000000),
      currency: 'XAF',
      priceUnit: PriceUnit.TOTAL,
      quartierId: quartiers.loandjili,
      address: 'Mpaka, Pointe-Noire',
      lat: -4.7901,
      lng: 11.862,
      countryId: cgId,
      visitEnabled: false,
      bedrooms: 3,
      bathrooms: 2,
      surface: 140,
      listingStatus: ListingStatus.UNDER_OFFER,
      availableFrom: null,
      isFeatured: false,
      floor: 'R+1',
      yearBuilt: 2016,
      condition: 'Bon état',
      parkingSpaces: 1,
      features: [
        'cuisine',
        'climatisation',
        'wifi',
        'terrasse',
        'parking',
        'securite',
        'eau_courante',
      ],
      mapViews: ['neighborhood'],
    },
  });

  await prisma.property.upsert({
    where: { id: DEMO_PROPERTY_RENT_SOON_ID },
    update: {
      title: 'Studio Lumumba',
      description:
        'Studio rénové près du centre Lumumba. Libre bientôt — idéal pour une location longue durée.',
      status: PropertyStatus.ACTIVE,
      visitType: VisitType.FREE,
      visitEnabled: true,
      quartierId: quartiers.centreVille,
      address: 'Quartier Lumumba, Pointe-Noire',
      lat: -4.7712,
      lng: 11.868,
      price: new Prisma.Decimal(75000),
      bedrooms: 1,
      bathrooms: 1,
      surface: 42,
      listingStatus: ListingStatus.AVAILABLE_SOON,
      availableFrom: availableFromSoon,
      isFeatured: false,
      floor: '3e étage',
      yearBuilt: 2010,
      condition: 'Rénové',
      features: ['cuisine', 'climatisation', 'wifi', 'meuble', 'eau_courante'],
      mapViews: ['neighborhood'],
    },
    create: {
      id: DEMO_PROPERTY_RENT_SOON_ID,
      ownerId: TEST_USER_IDS.owner,
      organizationId: PARADIS_IMMO_ID,
      title: 'Studio Lumumba',
      description:
        'Studio rénové près du centre Lumumba. Libre bientôt — idéal pour une location longue durée.',
      type: PropertyType.APARTMENT,
      mode: PropertyMode.RENT_LONG,
      status: PropertyStatus.ACTIVE,
      price: new Prisma.Decimal(75000),
      currency: 'XAF',
      priceUnit: PriceUnit.MONTH,
      quartierId: quartiers.centreVille,
      address: 'Quartier Lumumba, Pointe-Noire',
      lat: -4.7712,
      lng: 11.868,
      countryId: cgId,
      visitEnabled: true,
      visitType: VisitType.FREE,
      bedrooms: 1,
      bathrooms: 1,
      surface: 42,
      listingStatus: ListingStatus.AVAILABLE_SOON,
      availableFrom: availableFromSoon,
      isFeatured: false,
      floor: '3e étage',
      yearBuilt: 2010,
      condition: 'Rénové',
      features: ['cuisine', 'climatisation', 'wifi', 'meuble', 'eau_courante'],
      mapViews: ['neighborhood'],
    },
  });

  await upsertPropertyMedia(DEMO_PROPERTY_ID, SEED_IDS.mediaRent, [2, 3, 4]);
  await upsertPropertyMedia(
    DEMO_PROPERTY_SALE_ID,
    SEED_IDS.mediaSale,
    [1, 5, 6],
  );
  await upsertPropertyMedia(
    DEMO_PROPERTY_SHORT_ID,
    SEED_IDS.mediaShort,
    [3, 1, 2],
  );
  await upsertPropertyMedia(DEMO_PROPERTY_LAND_ID, SEED_IDS.mediaLand, [4, 6]);
  await upsertPropertyMedia(
    DEMO_PROPERTY_UNDER_OFFER_ID,
    SEED_IDS.mediaUnderOffer,
    [1, 2],
  );
  await upsertPropertyMedia(
    DEMO_PROPERTY_RENT_SOON_ID,
    SEED_IDS.mediaRentSoon,
    [3, 4],
  );
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
      const slotId = SEED_IDS.visitSlots[slotIndex];
      if (!slotId) break;
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

  // Paid-visit slots on Villa (sale)
  let saleSlotIndex = 0;
  for (
    let day = 1;
    day <= 7 && saleSlotIndex < SEED_IDS.visitSlotsSale.length;
    day += 1
  ) {
    const date = new Date(slotBase);
    date.setDate(date.getDate() + day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    for (const hour of [10, 15]) {
      const startAt = new Date(date);
      startAt.setHours(hour, 0, 0, 0);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + 45);
      const slotId = SEED_IDS.visitSlotsSale[saleSlotIndex];
      if (!slotId) break;
      await prisma.visitSlot.upsert({
        where: { id: slotId },
        update: {
          status: VisitSlotStatus.AVAILABLE,
          startAt,
          endAt,
          propertyId: DEMO_PROPERTY_SALE_ID,
        },
        create: {
          id: slotId,
          propertyId: DEMO_PROPERTY_SALE_ID,
          startAt,
          endAt,
          status: VisitSlotStatus.AVAILABLE,
          source: VisitSlotSource.MANUAL,
        },
      });
      saleSlotIndex += 1;
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

  // Active mandates: rent-long assigned to field agent; sale unassigned (gérant-only).
  await prisma.mandate.upsert({
    where: { id: SEED_IDS.mandateRentLong },
    update: {
      status: MandateStatus.ACTIVE,
      organizationId: PARADIS_IMMO_ID,
      propertyId: DEMO_PROPERTY_ID,
      assignedAgentId: TEST_USER_IDS.agent,
      endDate: null,
    },
    create: {
      id: SEED_IDS.mandateRentLong,
      propertyId: DEMO_PROPERTY_ID,
      organizationId: PARADIS_IMMO_ID,
      assignedAgentId: TEST_USER_IDS.agent,
      status: MandateStatus.ACTIVE,
    },
  });
  await prisma.mandate.upsert({
    where: { id: SEED_IDS.mandateSale },
    update: {
      status: MandateStatus.ACTIVE,
      organizationId: PARADIS_IMMO_ID,
      propertyId: DEMO_PROPERTY_SALE_ID,
      assignedAgentId: null,
      endDate: null,
    },
    create: {
      id: SEED_IDS.mandateSale,
      propertyId: DEMO_PROPERTY_SALE_ID,
      organizationId: PARADIS_IMMO_ID,
      assignedAgentId: null,
      status: MandateStatus.ACTIVE,
    },
  });

  console.log('✓ Test accounts:');
  console.log(
    `    admin    admin@paradisimmo.cg / Admin123!  → /login → /admin/dashboard`,
  );
  console.log(
    `    owner    owner@paradisimmo.cg / Owner123!  → /login → /owner/dashboard`,
  );
  console.log(
    `    manager  manager@paradisimmo.cg / Manager123!  → /login → /agent/dashboard (gérant)`,
  );
  console.log(
    `    agent    agent@paradisimmo.cg / Agent123!  → /login → /agent/dashboard (field)`,
  );
  console.log(
    `    tenant   ${TEST_ACCOUNTS.tenant.phone}  → mobile OTP only`,
  );
  console.log('✓ Mandates (Paradis Immo):');
  console.log(
    `    ${SEED_IDS.mandateRentLong}  rent-long → assigned to agent`,
  );
  console.log(
    `    ${SEED_IDS.mandateSale}  sale → unassigned (gérant only)`,
  );
  console.log('✓ Demo properties (Pointe-Noire + R2 photos):');
  console.log(
    `    ${DEMO_PROPERTY_ID}  RENT_LONG/OCCUPIED  Appartement Centre-ville`,
  );
  console.log(
    `    ${DEMO_PROPERTY_SALE_ID}  SALE/AVAILABLE  Villa Whispering Pines`,
  );
  console.log(
    `    ${DEMO_PROPERTY_SHORT_ID}  RENT_SHORT/FEATURED  Maison Tié-Tié`,
  );
  console.log(`    ${DEMO_PROPERTY_LAND_ID}  SALE/SOLD  Terrain Mongo-Poukou`);
  console.log(
    `    ${DEMO_PROPERTY_UNDER_OFFER_ID}  SALE/UNDER_OFFER  Duplex Mpaka`,
  );
  console.log(
    `    ${DEMO_PROPERTY_RENT_SOON_ID}  RENT_LONG/AVAILABLE_SOON  Studio Lumumba`,
  );
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
        name_arrondissementId: {
          name: `${a.name}-Centre`,
          arrondissementId: arr.id,
        },
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
        name_arrondissementId: {
          name: `${a.name}-Centre`,
          arrondissementId: arr.id,
        },
      },
      update: {},
      create: { name: `${a.name}-Centre`, arrondissementId: arr.id },
    });
  }
  console.log(`✓ Pointe-Noire: ${pnrArrondissements.length} arrondissements`);

  // 4. Paradis Immo platform organization (official marketplace agency)
  const paradisHub = {
    name: 'Agence Paradis Immo',
    shortName: 'Paradis Immo',
    tagline: "L'agence officielle de la plateforme",
    address: 'Centre-ville, Pointe-Noire',
    phone: '+242 06 500 00 00',
    cityLabel: 'Pointe-Noire',
    logoColor: '#7065F0',
    isOfficial: true,
    verified: true,
    foundedYear: 2012,
    rating: 4.9,
    reviewCount: 128,
    dealSuccessPercent: 94,
  } as const;
  const paradis = await prisma.organization.upsert({
    where: { id: PARADIS_IMMO_ID },
    update: {
      ...paradisHub,
      type: OrganizationType.PLATFORM,
      affiliationStatus: null,
    },
    create: {
      id: PARADIS_IMMO_ID,
      type: OrganizationType.PLATFORM,
      affiliationStatus: null,
      countryId: cg.id,
      ...paradisHub,
    },
  });
  console.log(`✓ Organization: ${paradis.name} (${paradis.id})`);

  await seedPartnerAgencies(cg.id);
  const demoQuartier = await prisma.quartier.findFirst({
    where: {
      name: 'Poto-Poto-Centre',
      arrondissement: { cityId: bzv.id },
    },
  });
  if (!demoQuartier) {
    throw new Error('Poto-Poto-Centre quartier missing after seed');
  }

  async function pnrQuartier(name: string): Promise<string> {
    const q = await prisma.quartier.findFirst({
      where: {
        name: `${name}-Centre`,
        arrondissement: { cityId: pnr.id },
      },
    });
    if (!q) throw new Error(`${name}-Centre quartier missing after seed`);
    return q.id;
  }

  // Centre-ville listings use Lumumba (1er) as closest seed quartier.
  const quartiers = {
    centreVille: await pnrQuartier('Lumumba'),
    loandjili: await pnrQuartier('Loandjili'),
    tieTie: await pnrQuartier('Tié-Tié'),
    mongo: await pnrQuartier('Mongo-Mpoukou'),
  };

  await purgeLegacySeedArtifacts();
  await seedTestUsers(cg.id, quartiers);
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
