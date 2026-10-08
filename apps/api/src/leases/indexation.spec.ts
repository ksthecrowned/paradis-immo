import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LeasesModule } from './leases.module';
import { IndexationService } from './indexation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { R2Service } from '../media/r2.service';

/**
 * Spec 04 P2 — révision annuelle du loyer (US 8).
 *
 * The contractual `indexationRate` is applied 30 days before the anniversary:
 * under a live mandate it becomes a RENT_INCREASE / RENT_REDUCTION approval,
 * without one the owner is notified directly. Approving the increase rewrites
 * the lease and the future rent lines.
 */
describe('IndexationService — révision annuelle (spec 04 P2)', () => {
  let service: IndexationService;
  let approvals: MandateApprovalService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
  let mandatedPropertyId: string;
  let agencyOrgId: string;
  let agencyUserId: string;
  const DAY = 86_400_000;
  const createdLeaseIds: string[] = [];
  const createdApprovalIds: string[] = [];
  const phones = {
    owner: '+242070000091',
    agency: '+242070000092',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, LeasesModule],
    })
      .overrideProvider(MandateApprovalService)
      .useValue({
        requireApproval: jest.fn(async (input: Record<string, unknown>) => ({
          id: `approval-${String(input.actionType)}`,
          status: 'PENDING',
        })),
      })
      .overrideProvider(R2Service)
      .useValue({
        uploadPrivateFile: jest.fn(async () => ({ url: 'https://x/y', key: 'y' })),
        uploadLeaseFile: jest.fn(async () => ({ url: 'https://x/y', key: 'y' })),
        keyFromPublicUrl: jest.fn(() => 'y'),
      })
      .compile();

    service = moduleRef.get(IndexationService);
    approvals = moduleRef.get(MandateApprovalService);
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

    await prisma.user.deleteMany({
      where: { phone: { in: Object.values(phones) } },
    });
    const owner = await prisma.user.create({
      data: { phone: phones.owner, countryId, name: 'Spec04 Index Owner' },
    });
    ownerUserId = owner.id;
    const agency = await prisma.user.create({
      data: { phone: phones.agency, countryId, name: 'Spec04 Index Agency' },
    });
    agencyUserId = agency.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Index Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Index Agency Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agencyUserId, role: 'ADMIN' } },
      },
    });
    agencyOrgId = agencyOrg.id;

    const base = {
      description: 'Révision',
      type: 'APARTMENT',
      mode: 'RENT_LONG',
      currency: 'XAF',
      priceUnit: 'MONTH',
      quartierId: bzvQuartierId,
      countryId,
      status: 'ACTIVE',
    } as const;
    propertyId = (
      await prisma.property.create({
        data: {
          ...base,
          title: 'Spec04 Index Property',
          price: 100000,
          address: 'Spec04 Index',
          ownerId: ownerUserId,
          organizationId: ownerOrg.id,
        },
      })
    ).id;
    mandatedPropertyId = (
      await prisma.property.create({
        data: {
          ...base,
          title: 'Spec04 Index Mandated',
          price: 100000,
          address: 'Spec04 Index mandat',
          ownerId: ownerUserId,
          organizationId: agencyOrg.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.mandateApproval.deleteMany({
      where: { id: { in: createdApprovalIds } },
    });
    await prisma.mandate.deleteMany({
      where: { propertyId: { in: [propertyId, mandatedPropertyId] } },
    });
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.notification
      .deleteMany({ where: { userId: { in: [ownerUserId, agencyUserId] } } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: [propertyId, mandatedPropertyId] } } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, agencyUserId] } },
    });
    await prisma.organization.deleteMany({ where: { id: agencyOrgId } }).catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, agencyUserId] } },
    });
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerUserId, agencyUserId] } } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  let slot = 0;

  /** ACTIVE lease whose 1st anniversary falls in `daysUntilAnniversary`. */
  async function leaseWithAnniversary(
    daysUntilAnniversary: number,
    rate: number,
  ): Promise<string> {
    slot += 1;
    const start = new Date(Date.now() - (365 - daysUntilAnniversary) * DAY);
    const end = new Date(start.getTime() + 3 * 365 * DAY);
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        startDate: start,
        endDate: end,
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
        indexationRate: rate,
        dueDay: 5,
      },
    });
    createdLeaseIds.push(lease.id);
    return lease.id;
  }

  it('proposes the indexed rent 30 days before the anniversary', async () => {
    const leaseId = await leaseWithAnniversary(20, 0.03);
    const proposals = await service.proposeDueIndexations(new Date());
    const proposal = proposals.find((p) => p.leaseId === leaseId);
    expect(proposal).toBeDefined();
    expect(proposal?.newMonthlyRent).toBe('103000');
    expect(proposal?.actionType).toBe('RENT_INCREASE');

    const notified = await prisma.notification.findFirst({
      where: { userId: ownerUserId, type: 'RENT_INDEXATION_PROPOSED' },
    });
    expect(notified).not.toBeNull();
    // No mandate on this property: no approval, the owner is told directly.
    expect(proposal?.approvalId).toBeNull();
  });

  it('never proposes twice for the same anniversary', async () => {
    await leaseWithAnniversary(21, 0.03);
    await service.proposeDueIndexations(new Date());
    const second = await service.proposeDueIndexations(new Date());
    const anniversaries = second.map((p) => `${p.leaseId}:${p.anniversary}`);
    expect(new Set(anniversaries).size).toBe(anniversaries.length);
  });

  it('ignores a lease whose anniversary is beyond the 30-day lead time', async () => {
    const leaseId = await leaseWithAnniversary(200, 0.03);
    const proposals = await service.proposeDueIndexations(new Date());
    expect(proposals.find((p) => p.leaseId === leaseId)).toBeUndefined();
  });

  it('under a live mandate it files a RENT_INCREASE approval', async () => {
    const lease = await prisma.lease.create({
      data: {
        propertyId: mandatedPropertyId,
        startDate: new Date(Date.now() - 350 * DAY),
        endDate: new Date(Date.now() + 3 * 365 * DAY),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
        indexationRate: 0.05,
        dueDay: 5,
      },
    });
    createdLeaseIds.push(lease.id);
    await prisma.mandate.create({
      data: {
        propertyId: mandatedPropertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });

    const proposals = await service.proposeDueIndexations(new Date());
    const proposal = proposals.find((p) => p.leaseId === lease.id);
    expect(proposal?.newMonthlyRent).toBe('105000');
    expect(proposal?.actionType).toBe('RENT_INCREASE');
    expect(proposal?.approvalId).toBe('approval-RENT_INCREASE');
    expect(approvals.requireApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'RENT_INCREASE',
        sourceType: 'LEASE',
        payload: expect.objectContaining({
          leaseId: lease.id,
          newMonthlyRent: '105000',
          previousMonthlyRent: '100000',
        }),
      }),
    );
  });

  it('a reduction rate proposes a RENT_REDUCTION', async () => {
    const leaseId = await leaseWithAnniversary(18, -0.05);
    const proposals = await service.proposeDueIndexations(new Date());
    const proposal = proposals.find((p) => p.leaseId === leaseId);
    expect(proposal?.actionType).toBe('RENT_REDUCTION');
    expect(proposal?.newMonthlyRent).toBe('95000');
  });

  it('lists the revision proposals of a lease for its owner only', async () => {
    const leaseId = await leaseWithAnniversary(25, 0.03);
    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });
    const approval = await prisma.mandateApproval.create({
      data: {
        mandateId: mandate.id,
        actionType: 'RENT_INCREASE',
        status: 'PENDING',
        sourceType: 'LEASE',
        sourceId: leaseId,
        payload: {
          leaseId,
          previousMonthlyRent: '100000',
          newMonthlyRent: '103000',
          effectiveFrom: new Date(Date.now() + 25 * DAY).toISOString(),
          indexationRate: '0.03',
        },
        requestedById: ownerUserId,
        expiresAt: new Date(Date.now() + 7 * DAY),
      },
    });
    createdApprovalIds.push(approval.id);
    createdLeaseIds.push(leaseId);

    const rows = await service.listForLease(ownerUserId, leaseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: approval.id,
      actionType: 'RENT_INCREASE',
      status: 'PENDING',
      previousMonthlyRent: '100000',
      newMonthlyRent: '103000',
      rate: '0.03',
    });

    // A user with no link to the property cannot read the proposals.
    const outsider = await prisma.user.create({
      data: { phone: '+242070000099', countryId, name: 'Spec04 Index Outsider' },
    });
    try {
      await expect(service.listForLease(outsider.id, leaseId)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await prisma.user.delete({ where: { id: outsider.id } }).catch(() => undefined);
    }
  });
});
