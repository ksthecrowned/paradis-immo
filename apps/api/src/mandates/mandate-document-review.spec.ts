import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditLogService } from '../common/audit-log.service';
import { EventPublisher } from '../events/event.publisher';
import { R2Service } from '../media/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from './agency-access.service';
import { MandateDocumentReviewService } from './mandate-document-review.service';

describe('MandateDocumentReviewService', () => {
  let service: MandateDocumentReviewService;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let adminId: string;
  let agentId: string;
  let orgId: string;
  let propertyId: string;
  let mandateId: string;
  const suffix = String(Date.now()).slice(-8);
  const fakeR2 = {
    uploadPrivateFile: jest.fn(
      async (p: { folder: string; ownerId: string; filename: string }) => ({
        key: `private/${p.folder}/${p.ownerId}/${p.filename}`,
        url: 'https://example.test/doc',
      }),
    ),
  };
  const fakeEvents = { emit: jest.fn(async () => undefined) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MandateDocumentReviewService,
        PrismaService,
        AuditLogService,
        AgencyAccessService,
        { provide: R2Service, useValue: fakeR2 },
        { provide: EventPublisher, useValue: fakeEvents },
      ],
    }).compile();
    service = moduleRef.get(MandateDocumentReviewService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG required');
    countryId = cg.id;
    const q = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!q) throw new Error('Seed quartier required');
    quartierId = q.id;

    const admin = await prisma.user.create({
      data: { phone: `+242074${suffix}1`, countryId, name: 'Doc Review Admin' },
    });
    adminId = admin.id;
    const agent = await prisma.user.create({
      data: { phone: `+242074${suffix}2`, countryId, name: 'Doc Review Agent' },
    });
    agentId = agent.id;
    const org = await prisma.organization.create({
      data: {
        name: `Doc Review Agency ${suffix}`,
        type: 'AGENCY',
        countryId,
        shortName: `dr${suffix}`.slice(0, 20),
      },
    });
    orgId = org.id;
    await prisma.organizationMember.create({
      data: {
        userId: adminId,
        organizationId: orgId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await prisma.organizationMember.create({
      data: {
        userId: agentId,
        organizationId: orgId,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });
    const client = await prisma.agencyClient.create({
      data: {
        organizationId: orgId,
        displayName: 'External',
        phoneE164: `+242074${suffix}9`,
        createdById: adminId,
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: `Doc review prop ${suffix}`,
        description: 'paper mandate',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 1,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: null,
        agencyClientId: client.id,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });
    propertyId = prop.id;
    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: orgId,
        status: 'PROPOSED',
        proposedById: adminId,
        initiator: 'AGENCY',
        documentReviewStatus: 'PENDING',
        documentVersion: 0,
      },
    });
    mandateId = mandate.id;
  });

  afterAll(async () => {
    await prisma.mandateDocumentReviewDecision
      .deleteMany({ where: { mandateId } })
      .catch(() => undefined);
    await prisma.mandate
      .deleteMany({ where: { id: mandateId } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: propertyId } })
      .catch(() => undefined);
    await prisma.agencyClient
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { id: orgId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [adminId, agentId] } } })
      .catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });

  it('agency ADMIN can deposit a paper PDF; AGENT cannot', async () => {
    await expect(
      service.depositPaperDocument({
        mandateId,
        userId: agentId,
        file: {
          buffer: Buffer.from('%PDF-1.4'),
          originalname: 'mandat.pdf',
          mimetype: 'application/pdf',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const deposited = await service.depositPaperDocument({
      mandateId,
      userId: adminId,
      file: {
        buffer: Buffer.from('%PDF-1.4 paper'),
        originalname: 'mandat.pdf',
        mimetype: 'application/pdf',
      },
    });
    expect(deposited.documentVersion).toBe(1);
    expect(deposited.documentReviewStatus).toBe('PENDING');
    expect(deposited.signedDocumentKey).toContain('mandates/paper');
    expect(fakeEvents.emit).toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    await expect(
      service.decide({
        mandateId,
        adminUserId: adminId,
        decision: 'APPROVED',
        reason: '  ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('REJECTED pauses listing and records immutable decision', async () => {
    await service.decide({
      mandateId,
      adminUserId: adminId,
      decision: 'REJECTED',
      reason: 'Missing ownership proof pages',
    });
    const mandate = await prisma.mandate.findUniqueOrThrow({
      where: { id: mandateId },
    });
    expect(mandate.documentReviewStatus).toBe('REJECTED');
    expect(mandate.status).toBe('DECLINED');
    const prop = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    expect(prop.status).toBe('PAUSED');
    const history = await prisma.mandateDocumentReviewDecision.findMany({
      where: { mandateId },
    });
    expect(history).toHaveLength(1);
    expect(history[0].reason).toContain('ownership');
  });
});
