import { Test } from '@nestjs/testing';
import {
  AgencyClientLinkStatus,
  OrganizationType,
  Prisma,
  PropertyMode,
  PropertyType,
  PriceUnit,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lot 1 — contraintes / relations AgencyClient (migration additive).
 * Requires seeded CG country + quartier and migrated schema.
 */
describe('AgencyClient model constraints', () => {
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let agencyOrgId: string;
  let otherAgencyOrgId: string;
  let adminUserId: string;
  let linkedUserId: string;
  const suffix = `ac${String(Date.now()).slice(-8)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG required');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed quartier required');
    quartierId = quartier.id;

    const admin = await prisma.user.create({
      data: {
        phone: `+24206${suffix}1`,
        countryId,
        name: 'CRM Admin',
      },
    });
    adminUserId = admin.id;
    const linked = await prisma.user.create({
      data: {
        phone: `+24206${suffix}2`,
        countryId,
        name: 'CRM Linked Owner',
      },
    });
    linkedUserId = linked.id;

    const agency = await prisma.organization.create({
      data: {
        name: `CRM Agency ${suffix}`,
        type: OrganizationType.AGENCY,
        countryId,
        shortName: `crm${suffix}`.slice(0, 20),
      },
    });
    agencyOrgId = agency.id;
    const other = await prisma.organization.create({
      data: {
        name: `CRM Other ${suffix}`,
        type: OrganizationType.AGENCY,
        countryId,
        shortName: `cro${suffix}`.slice(0, 20),
      },
    });
    otherAgencyOrgId = other.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates an external contact without a User row', async () => {
    const client = await prisma.agencyClient.create({
      data: {
        organizationId: agencyOrgId,
        displayName: 'External Owner',
        phoneE164: `+24206${suffix}9`,
        linkStatus: AgencyClientLinkStatus.UNLINKED,
        createdById: adminUserId,
      },
    });
    expect(client.userId).toBeNull();
    expect(client.linkStatus).toBe(AgencyClientLinkStatus.UNLINKED);

    const prop = await prisma.property.create({
      data: {
        ownerId: null,
        agencyClientId: client.id,
        organizationId: agencyOrgId,
        title: `External prop ${suffix}`,
        description: 'CRM external owner',
        type: PropertyType.APARTMENT,
        mode: PropertyMode.RENT_LONG,
        price: 100000,
        currency: 'XAF',
        priceUnit: PriceUnit.MONTH,
        quartierId,
        address: 'Test',
        countryId,
      },
    });
    expect(prop.ownerId).toBeNull();
    expect(prop.agencyClientId).toBe(client.id);
  });

  it('rejects a property with neither ownerId nor agencyClientId', async () => {
    await expect(
      prisma.property.create({
        data: {
          ownerId: null,
          agencyClientId: null,
          organizationId: agencyOrgId,
          title: `Invalid ${suffix}`,
          description: 'no owner',
          type: PropertyType.APARTMENT,
          mode: PropertyMode.RENT_LONG,
          price: 1,
          currency: 'XAF',
          priceUnit: PriceUnit.MONTH,
          quartierId,
          address: 'Test',
          countryId,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('enforces one active phone per agency and allows same phone in another agency', async () => {
    const phone = `+24206${suffix}8`;
    await prisma.agencyClient.create({
      data: {
        organizationId: agencyOrgId,
        displayName: 'Dup A',
        phoneE164: phone,
        createdById: adminUserId,
      },
    });
    await expect(
      prisma.agencyClient.create({
        data: {
          organizationId: agencyOrgId,
          displayName: 'Dup B',
          phoneE164: phone,
          createdById: adminUserId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' } satisfies Partial<Prisma.PrismaClientKnownRequestError>);

    const other = await prisma.agencyClient.create({
      data: {
        organizationId: otherAgencyOrgId,
        displayName: 'Other agency same phone',
        phoneE164: phone,
        createdById: adminUserId,
      },
    });
    expect(other.organizationId).toBe(otherAgencyOrgId);
  });

  it('enforces one active linked user per agency and allows multi-agency links', async () => {
    await prisma.agencyClient.create({
      data: {
        organizationId: agencyOrgId,
        displayName: 'Linked',
        userId: linkedUserId,
        phoneE164: `+24206${suffix}2`,
        linkStatus: AgencyClientLinkStatus.LINKED,
        createdById: adminUserId,
      },
    });
    await expect(
      prisma.agencyClient.create({
        data: {
          organizationId: agencyOrgId,
          displayName: 'Linked dup',
          userId: linkedUserId,
          linkStatus: AgencyClientLinkStatus.LINKED,
          createdById: adminUserId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const cross = await prisma.agencyClient.create({
      data: {
        organizationId: otherAgencyOrgId,
        displayName: 'Same user other agency',
        userId: linkedUserId,
        linkStatus: AgencyClientLinkStatus.LINKED,
        createdById: adminUserId,
      },
    });
    expect(cross.userId).toBe(linkedUserId);
  });

  it('archives free the phone uniqueness slot and records owner change', async () => {
    const phone = `+24206${suffix}7`;
    const first = await prisma.agencyClient.create({
      data: {
        organizationId: agencyOrgId,
        displayName: 'To archive',
        phoneE164: phone,
        createdById: adminUserId,
      },
    });
    await prisma.agencyClient.update({
      where: { id: first.id },
      data: { archivedAt: new Date() },
    });
    const second = await prisma.agencyClient.create({
      data: {
        organizationId: agencyOrgId,
        displayName: 'Reuse phone',
        phoneE164: phone,
        createdById: adminUserId,
      },
    });
    expect(second.id).not.toBe(first.id);

    const prop = await prisma.property.create({
      data: {
        ownerId: linkedUserId,
        agencyClientId: second.id,
        organizationId: agencyOrgId,
        title: `Change log ${suffix}`,
        description: 'audit',
        type: PropertyType.APARTMENT,
        mode: PropertyMode.RENT_LONG,
        price: 1,
        currency: 'XAF',
        priceUnit: PriceUnit.MONTH,
        quartierId,
        address: 'Test',
        countryId,
      },
    });
    const log = await prisma.propertyOwnerChangeLog.create({
      data: {
        propertyId: prop.id,
        fromAgencyClientId: second.id,
        toAgencyClientId: first.id,
        fromOwnerId: linkedUserId,
        toOwnerId: null,
        changedById: adminUserId,
        reason: 'reassign',
      },
    });
    expect(log.propertyId).toBe(prop.id);
  });
});
