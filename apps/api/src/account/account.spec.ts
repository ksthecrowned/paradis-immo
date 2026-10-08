import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { KycService } from './kyc.service';
import { DataExportService } from './data-export.service';

describe('KycService (spec 01 — P1)', () => {
  let kyc: KycService;
  let prisma: PrismaService;
  let countryId: string;
  let ownerId: string;
  let strangerId: string;
  let orgId: string;
  const uploadedKeys: string[] = [];

  const fakeR2 = {
    uploadPrivateFile: jest.fn(async (p: { folder: string; ownerId: string; filename: string }) => {
      const key = `${p.folder}/${p.ownerId}/${p.filename}`;
      uploadedKeys.push(key);
      return { url: `https://fake.r2/${key}`, key };
    }),
    createPresignedDownload: jest.fn(
      async (key: string, ttl: number) =>
        `https://fake.r2/${key}?sig=x&ttl=${ttl}`,
    ),
  };

  const file = (name = 'cni.pdf') => ({
    buffer: Buffer.from('%PDF-1.4 fake'),
    originalname: name,
    mimetype: 'application/pdf',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        KycService,
        PrismaService,
        { provide: R2Service, useValue: fakeR2 },
      ],
    }).compile();
    kyc = moduleRef.get(KycService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    const phones = ['+242063300001', '+242063300002'];
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });

    const owner = await prisma.user.create({
      data: { phone: phones[0], countryId, name: 'KYC Owner' },
    });
    ownerId = owner.id;
    const stranger = await prisma.user.create({
      data: { phone: phones[1], countryId, name: 'KYC Stranger' },
    });
    strangerId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `KYC Spec Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Guard every id: after a midway beforeAll failure an undefined id would
    // turn these deleteMany calls into full-table deletes.
    if (orgId) {
      await prisma.kycSubmission.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    const userIds = [ownerId, strangerId].filter(Boolean);
    if (userIds.length) {
      await prisma.kycSubmission.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { kycStatus: 'NONE' },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.onModuleDestroy();
  });

  it('accepts a user submission and marks the account PENDING', async () => {
    const created = await kyc.submit(ownerId, file(), { documentType: 'ID_CARD' });
    expect(created.status).toBe('PENDING');
    expect(created.fileUrl).toContain('https://fake.r2/');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    expect(user.kycStatus).toBe('PENDING');
  });

  it('lists my submissions with a signed URL', async () => {
    const mine = await kyc.mine(ownerId);
    expect(mine.length).toBeGreaterThanOrEqual(1);
    expect(mine[0].fileUrl).toContain('sig=x');
  });

  it('rejects an unsupported document type', async () => {
    await expect(
      kyc.submit(ownerId, file('x.pdf'), { documentType: 'DRIVER_LICENCE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non image/pdf file', async () => {
    await expect(
      kyc.submit(
        ownerId,
        { buffer: Buffer.from('x'), originalname: 'x.bin', mimetype: 'application/octet-stream' },
        { documentType: 'ID_CARD' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids a non-member from submitting for an organization', async () => {
    await expect(
      kyc.submit(strangerId, file('rccm.pdf'), {
        documentType: 'RCCM',
        organizationId: orgId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an org OWNER submit an RCCM and flips Organization.verified on approval', async () => {
    const created = await kyc.submit(ownerId, file('rccm.pdf'), {
      documentType: 'RCCM',
      organizationId: orgId,
    });
    expect(created.organizationId).toBe(orgId);

    await kyc.review('admin-user', created.id, {
      status: 'VERIFIED',
    });
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    expect(org.verified).toBe(true);
    const sub = await prisma.kycSubmission.findUniqueOrThrow({ where: { id: created.id } });
    expect(sub.status).toBe('VERIFIED');
    expect(sub.reviewedAt).not.toBeNull();
  });

  it('requires a reason when rejecting', async () => {
    const created = await kyc.submit(ownerId, file('bad.pdf'), {
      documentType: 'PASSPORT',
    });
    await expect(
      kyc.review('admin-user', created.id, { status: 'REJECTED' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const reviewed = await kyc.review('admin-user', created.id, {
      status: 'REJECTED',
      rejectionReason: 'Image illisible',
    });
    expect(reviewed.status).toBe('REJECTED');
    expect(reviewed.rejectionReason).toBe('Image illisible');
  });

  it('404 on reviewing an unknown dossier', async () => {
    await expect(
      kyc.review('admin-user', 'does-not-exist', { status: 'VERIFIED' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DataExportService (spec 01 — P2)', () => {
  let exports: DataExportService;
  let prisma: PrismaService;
  let countryId: string;
  let userId: string;
  let jobId: string | null = null;

  const fakeR2 = {
    uploadPrivateFile: jest.fn(async (p: { ownerId: string }) => ({
      url: `https://fake.r2/exports/${p.ownerId}/file.json`,
      key: `exports/${p.ownerId}/file.json`,
    })),
    createPresignedDownload: jest.fn(
      async (key: string) => `https://fake.r2/${key}?sig=export`,
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DataExportService,
        PrismaService,
        { provide: R2Service, useValue: fakeR2 },
      ],
    }).compile();
    exports = moduleRef.get(DataExportService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findFirstOrThrow();
    countryId = country.id;
    await prisma.user.deleteMany({ where: { phone: '+242063300010' } });
    const user = await prisma.user.create({
      data: { phone: '+242063300010', countryId, name: 'Export User' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.dataExportRequest.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('creates an export that becomes READY with a signed URL', async () => {
    const status = await exports.request(userId);
    jobId = status.id;
    expect(status.status).toBe('READY');
    expect(fakeR2.uploadPrivateFile).toHaveBeenCalledTimes(1);

    const full = await exports.get(userId, status.id);
    expect(full.status).toBe('READY');
    expect(full.url).toContain('https://fake.r2/exports/');
    expect(full.expiresAt).toBeTruthy();
  });

  it('404s when fetching another user’s export', async () => {
    expect(jobId).toBeTruthy();
    await expect(exports.get('other-user', jobId!)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
