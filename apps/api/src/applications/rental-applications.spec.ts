import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { LeasesService } from '../leases/leases.service';
import { RentalApplicationsService } from './rental-applications.service';

/**
 * Spec 04 P1 — candidatures (rental applications).
 *
 * Covers the funnel rules the spec states: one candidature per candidate and
 * per property, withdrawal only while open, rejection requires a reason,
 * accepting one candidature auto-rejects its siblings, solvency consent is
 * requested against the candidature, and the DRAFT lease is pre-filled.
 */
describe('Rental applications (spec 04 P1)', () => {
  let prisma: PrismaService;
  let applications: RentalApplicationsService;
  let emitted: { name: string; payload: Record<string, unknown> }[];

  /**
   * Stand-in for `LeasesService.createLease`. It persists a real (minimal)
   * DRAFT row, because the service links `application.leaseId` to it and the
   * FK would fail against a fake id.
   */
  let createLeaseMock: jest.Mock;

  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let propertyId: string;
  let orgId: string;
  let mandateId: string;

  const applicantPhones = [
    '+242076660001',
    '+242076660002',
    '+242076660003',
  ];
  let applicantIds: string[] = [];

  const cleanupPhones = () => [
    ...applicantPhones,
    '+242076660000',
    '+242076660100',
  ];

  /** Remove everything a crashed run may have left for our fixtures. */
  const purgeFixtures = async () => {
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: 'App Test ' } },
      select: { id: true },
    });
    const orgIds = orgs.map((o) => o.id);
    if (orgIds.length) {
      const props = await prisma.property.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true },
      });
      const propIds = props.map((p) => p.id);
      if (propIds.length) {
        const apps = await prisma.rentalApplication.findMany({
          where: { propertyId: { in: propIds } },
          select: { id: true, leaseId: true },
        });
        const appIds = apps.map((a) => a.id);
        await prisma.solvencyCheck.deleteMany({
          where: { applicationId: { in: appIds } },
        });
        // Applications go first: they hold the only FK pointing at a Lease,
        // and each test's beforeEach may have already orphaned one.
        await prisma.rentalApplication.deleteMany({
          where: { id: { in: appIds } },
        });
        const leases = await prisma.lease.findMany({
          where: { propertyId: { in: propIds } },
          select: { id: true },
        });
        const leaseIds = leases.map((l) => l.id);
        if (leaseIds.length) {
          const schedules = await prisma.rentSchedule.findMany({
            where: { leaseId: { in: leaseIds } },
            select: { id: true },
          });
          const scheduleIds = schedules.map((s) => s.id);
          await prisma.rentReceipt.deleteMany({
            where: { rentScheduleId: { in: scheduleIds } },
          });
          await prisma.paymentAllocation.deleteMany({
            where: { rentScheduleId: { in: scheduleIds } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { id: { in: scheduleIds } },
          });
          await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
        }
        await prisma.mandate.deleteMany({
          where: { propertyId: { in: propIds } },
        });
        await prisma.property.deleteMany({ where: { id: { in: propIds } } });
      }
      await prisma.documentSequence.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    // Users RESTRICT on UserRole / OrganizationMember, so both go first.
    const stale = await prisma.user.findMany({
      where: { phone: { in: cleanupPhones() } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }
  };

  beforeAll(async () => {
    emitted = [];
    createLeaseMock = jest.fn(
      async (_managerId: string, input: Record<string, unknown>) =>
        prisma.lease.create({
          data: {
            propertyId: input.propertyId as string,
            tenantId: (input.tenantId as string) ?? null,
            invitedPhone: (input.invitedPhone as string) ?? null,
            startDate: input.startDate as Date,
            endDate: input.endDate as Date,
            monthlyRent: new Prisma.Decimal(input.monthlyRent as number),
            deposit: new Prisma.Decimal(input.deposit as number),
            currency: input.currency as string,
            status: 'DRAFT',
            dueDay: (input.dueDay as number) ?? 1,
          },
        }),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        RentalApplicationsService,
        AgencyAccessService,
        PrismaService,
        {
          provide: EventPublisher,
          useValue: {
            emit: jest.fn(async (name: string, payload: Record<string, unknown>) => {
              emitted.push({ name, payload });
              return { id: 'evt', name };
            }),
          },
        },
        // LeasesService is only used to mint the DRAFT lease; stubbed so this
        // suite does not duplicate the whole lease-creation fixture chain.
        { provide: LeasesService, useValue: { createLease: createLeaseMock } },
      ],
    }).compile();
    applications = moduleRef.get(RentalApplicationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    await purgeFixtures();

    const stamp = Date.now();
    const owner = await prisma.user.create({
      data: {
        phone: '+242076660000',
        countryId,
        name: 'Owner App',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242076660100',
        countryId,
        name: 'Agent App',
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;

    applicantIds = [];
    for (const phone of applicantPhones) {
      const u = await prisma.user.create({
        data: {
          phone,
          countryId,
          name: `Applicant ${phone.slice(-3)}`,
          roles: { create: { role: 'TENANT' } },
        },
      });
      applicantIds.push(u.id);
    }

    const org = await prisma.organization.create({
      data: {
        name: `App Test Agency ${stamp}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'App Test Property',
        description: 'Pour tester les candidatures',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
      },
    });
    propertyId = prop.id;

    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: orgId,
        assignedAgentId: agentUserId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });
    mandateId = mandate.id;
  });

  afterAll(async () => {
    await purgeFixtures();
    if (orgId) {
      await prisma.documentSequence.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.userRole.deleteMany({
      where: {
        userId: {
          in: [ownerUserId, agentUserId, ...applicantIds].filter(Boolean),
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [ownerUserId, agentUserId, ...applicantIds].filter(Boolean) },
      },
    });
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    emitted = [];
    createLeaseMock.mockClear();
    // Start each test from a clean slate of candidatures.
    await prisma.solvencyCheck.deleteMany({
      where: { application: { propertyId } },
    });
    await prisma.rentalApplication.deleteMany({ where: { propertyId } });
  });

  const baseDto = (overrides: Record<string, unknown> = {}) => ({
    desiredMoveIn: new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    occupants: 2,
    ...overrides,
  });

  it('a seeker applies on a RENT_LONG listing', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto({ occupation: 'Ingénieur', declaredIncome: 900000 }),
    );

    expect(created.status).toBe('SUBMITTED');
    expect(created.propertyId).toBe(propertyId);
    expect(created.applicantId).toBe(applicantIds[0]);
    expect(created.occupants).toBe(2);
    expect(created.occupation).toBe('Ingénieur');
    expect(created.declaredIncome).toBe('900000');
    expect(created.leaseId).toBeNull();

    expect(
      emitted.some((e) => e.name === 'application.submitted'),
    ).toBe(true);
  });

  it('refuses a duplicate candidature for the same candidate and property (409)', async () => {
    await applications.apply(applicantIds[0], propertyId, baseDto());
    await expect(
      applications.apply(applicantIds[0], propertyId, baseDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a second, different candidate on the same property', async () => {
    await applications.apply(applicantIds[0], propertyId, baseDto());
    const second = await applications.apply(
      applicantIds[1],
      propertyId,
      baseDto(),
    );
    expect(second.applicantId).toBe(applicantIds[1]);
  });

  it('refuses applying on a non RENT_LONG property', async () => {
    const saleProp = await prisma.property.create({
      data: {
        title: 'App Test Sale',
        description: 'Vente, pas de candidature',
        type: 'APARTMENT',
        mode: 'SALE',
        price: 20_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
      },
    });
    await expect(
      applications.apply(applicantIds[0], saleProp.id, baseDto()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await prisma.property.delete({ where: { id: saleProp.id } });
  });

  it('refuses applying on an unknown property (404)', async () => {
    await expect(
      applications.apply(
        applicantIds[0],
        '00000000-0000-4000-8000-0000000000aa',
        baseDto(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the owner cannot apply on their own property', async () => {
    await expect(
      applications.apply(ownerUserId, propertyId, baseDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listMine returns the caller candidatures and nobody else’s', async () => {
    await applications.apply(applicantIds[0], propertyId, baseDto());
    await applications.apply(applicantIds[1], propertyId, baseDto());

    const mine = await applications.listMine(applicantIds[0]);
    expect(mine).toHaveLength(1);
    expect(mine[0].applicantId).toBe(applicantIds[0]);
    expect(mine[0].property?.title).toBe('App Test Property');

    const other = await applications.listMine(applicantIds[2]);
    expect(other).toHaveLength(0);
  });

  it('the candidate withdraws an open candidature', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    const withdrawn = await applications.withdraw(
      applicantIds[0],
      created.id,
    );
    expect(withdrawn.status).toBe('WITHDRAWN');
  });

  it('withdrawing someone else’s candidature is a 404', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await expect(
      applications.withdraw(applicantIds[1], created.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('an accepted candidature can no longer be withdrawn (409)', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });
    await expect(
      applications.withdraw(applicantIds[0], created.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('a withdrawn candidature can be submitted again', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto({ occupants: 1 }),
    );
    await applications.withdraw(applicantIds[0], created.id);
    const again = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto({ occupants: 4 }),
    );
    expect(again.id).toBe(created.id);
    expect(again.status).toBe('SUBMITTED');
    expect(again.occupants).toBe(4);
  });

  it('the manager lists candidatures with pagination metadata', async () => {
    for (const id of applicantIds) {
      await applications.apply(id, propertyId, baseDto());
    }
    const page = await applications.listForProperty(agentUserId, propertyId, {
      page: 1,
      pageSize: 2,
    });
    expect(page.data).toHaveLength(2);
    expect(page.meta.total).toBe(3);
    expect(page.meta.page).toBe(1);
    expect(page.meta.pageSize).toBe(2);
    expect(page.data[0].applicant?.phone).toBeTruthy();

    const second = await applications.listForProperty(agentUserId, propertyId, {
      page: 2,
      pageSize: 2,
    });
    expect(second.data).toHaveLength(1);
    expect(second.meta.page).toBe(2);
  });

  it('a stranger cannot list the candidatures of a property', async () => {
    await expect(
      applications.listForProperty(applicantIds[0], propertyId, {}),
    ).rejects.toThrow();
  });

  it('accepting a candidature auto-rejects its siblings with the given message', async () => {
    const winner = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    const loser1 = await applications.apply(
      applicantIds[1],
      propertyId,
      baseDto(),
    );
    const loser2 = await applications.apply(
      applicantIds[2],
      propertyId,
      baseDto(),
    );

    const accepted = await applications.decide(agentUserId, winner.id, {
      status: 'ACCEPTED',
    });
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.decidedById).toBe(agentUserId);

    for (const loser of [loser1, loser2]) {
      const row = await prisma.rentalApplication.findUniqueOrThrow({
        where: { id: loser.id },
      });
      expect(row.status).toBe('REJECTED');
      expect(row.rejectionMessage).toBe(
        'Le bien a été attribué à un autre candidat.',
      );
    }

    const autoRejects = emitted.filter(
      (e) =>
        e.name === 'application.rejected' &&
        e.payload.auto === true,
    );
    expect(autoRejects).toHaveLength(2);
  });

  it('rejecting a candidature requires a reason', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await expect(
      applications.decide(agentUserId, created.id, { status: 'REJECTED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('an already decided candidature cannot be decided again', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });
    await expect(
      applications.decide(agentUserId, created.id, {
        status: 'REJECTED',
        rejectionMessage: 'Trop tard',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('the manager requests a solvency check targeted at the candidature', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    const check = await applications.requestSolvencyCheck(
      agentUserId,
      created.id,
    );

    expect(check.status).toBe('PENDING');
    expect(check.applicationId).toBe(created.id);
    expect(check.tenantUserId).toBe(applicantIds[0]);
    expect(check.requesterOrgId).toBe(orgId);
    expect(check.expiresAt).toBeNull();

    const app = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(app.status).toBe('SOLVENCY_PENDING');
  });

  it('a second solvency request while one is pending is a 409', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.requestSolvencyCheck(agentUserId, created.id);
    await expect(
      applications.requestSolvencyCheck(agentUserId, created.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('answering the solvency check sends the candidature back to review', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.requestSolvencyCheck(agentUserId, created.id);

    await applications.onSolvencyDecided(created.id);

    const app = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(app.status).toBe('UNDER_REVIEW');
  });

  it('a late solvency answer never overrides a manager decision', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.requestSolvencyCheck(agentUserId, created.id);
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });

    await applications.onSolvencyDecided(created.id);

    const app = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(app.status).toBe('ACCEPTED');
  });

  it('an accepted candidature pre-fills a DRAFT lease from the listing', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });

    const lease = await applications.createLeaseFromApplication(
      agentUserId,
      created.id,
      {},
    );

    expect(lease.id).toEqual(expect.any(String));
    const args = createLeaseMock.mock.calls[0];
    expect(args[0]).toBe(agentUserId);
    expect(args[1]).toMatchObject({
      propertyId,
      tenantId: applicantIds[0],
      monthlyRent: 150000,
      // Deposit defaults to two months of rent.
      deposit: 300000,
      currency: 'XAF',
    });
    // Default term is 36 months from the desired move-in.
    const start = args[1].startDate as Date;
    const end = args[1].endDate as Date;
    expect(end.getUTCFullYear() - start.getUTCFullYear()).toBe(3);

    // The candidature is linked to the lease it produced.
    const linked = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(linked.leaseId).toBe(lease.id);

    const persisted = await prisma.lease.findUniqueOrThrow({
      where: { id: lease.id },
    });
    expect(persisted.status).toBe('DRAFT');
  });

  it('only an accepted candidature can spawn a lease', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await expect(
      applications.createLeaseFromApplication(agentUserId, created.id, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('overrides win over the pre-filled values', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });

    await applications.createLeaseFromApplication(agentUserId, created.id, {
      monthlyRent: 200000,
      deposit: 500000,
      dueDay: 5,
    });

    expect(createLeaseMock.mock.calls[0][1]).toMatchObject({
      monthlyRent: 200000,
      deposit: 500000,
      dueDay: 5,
    });
  });

  it('a candidature can only spawn one lease', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });

    await applications.createLeaseFromApplication(agentUserId, created.id, {});
    expect(createLeaseMock).toHaveBeenCalledTimes(1);

    await expect(
      applications.createLeaseFromApplication(agentUserId, created.id, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createLeaseMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an end date before the start date', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto(),
    );
    await applications.decide(agentUserId, created.id, { status: 'ACCEPTED' });
    await expect(
      applications.createLeaseFromApplication(agentUserId, created.id, {
        startDate: '2027-06-01',
        endDate: '2027-01-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createLeaseMock).not.toHaveBeenCalled();
  });

  it('declaredIncome is stored as a decimal', async () => {
    const created = await applications.apply(
      applicantIds[0],
      propertyId,
      baseDto({ declaredIncome: 1234.56 }),
    );
    const row = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.declaredIncome).toBeInstanceOf(Prisma.Decimal);
    expect(row.declaredIncome?.toString()).toBe('1234.56');
  });
});