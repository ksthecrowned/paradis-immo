import { ForbiddenException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from './r2.service';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const propertyId = 'property-1';
  const userId = 'user-1';
  const document = {
    id: 'document-1',
    propertyId,
    type: DocumentType.TITLE_DEED,
    url: null,
    fileKey: 'property-documents/property-1/private.pdf',
    name: 'Titre foncier',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prisma = {
    property: { findUnique: jest.fn() },
    propertyDocument: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const r2 = {
    uploadPrivatePropertyFile: jest.fn(),
    createPresignedPrivateDownload: jest.fn(),
    deletePrivateObject: jest.fn(),
  };
  const agencyAccess = {
    assertCanOperateOnProperty: jest.fn(),
  };
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    agencyAccess.assertCanOperateOnProperty.mockResolvedValue(undefined);
    service = new DocumentsService(
      prisma as unknown as PrismaService,
      r2 as unknown as R2Service,
      agencyAccess as unknown as AgencyAccessService,
    );
  });

  it('signs private object keys only after property access succeeds', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId });
    prisma.propertyDocument.findMany.mockResolvedValue([document]);
    r2.createPresignedPrivateDownload.mockResolvedValue(
      'https://signed.test/doc',
    );

    await expect(service.list(userId, propertyId)).resolves.toMatchObject([
      { id: document.id, url: 'https://signed.test/doc' },
    ]);
    expect(agencyAccess.assertCanOperateOnProperty).toHaveBeenCalledWith(
      userId,
      propertyId,
    );
    expect(r2.createPresignedPrivateDownload).toHaveBeenCalledWith(
      document.fileKey,
    );
  });

  it('does not sign or return a legacy public URL when access is denied', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId });
    agencyAccess.assertCanOperateOnProperty.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(service.list(userId, propertyId)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.propertyDocument.findMany).not.toHaveBeenCalled();
    expect(r2.createPresignedPrivateDownload).not.toHaveBeenCalled();
  });

  it('does not return a legacy public URL when an old record has no private key', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId });
    prisma.propertyDocument.findMany.mockResolvedValue([
      { ...document, url: 'https://public.test/old.pdf', fileKey: null },
    ]);

    await expect(service.list(userId, propertyId)).resolves.toMatchObject([
      { url: null },
    ]);
    expect(r2.createPresignedPrivateDownload).not.toHaveBeenCalled();
  });

  it('surfaces private URL-signing failures instead of falling back to a public URL', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId });
    prisma.propertyDocument.findMany.mockResolvedValue([document]);
    r2.createPresignedPrivateDownload.mockRejectedValue(
      new Error('Private storage unavailable'),
    );

    await expect(service.list(userId, propertyId)).rejects.toThrow(
      'Private storage unavailable',
    );
  });

  it('stores newly uploaded documents by private object key', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId });
    r2.uploadPrivatePropertyFile.mockResolvedValue({ key: document.fileKey });
    prisma.propertyDocument.create.mockResolvedValue(document);
    r2.createPresignedPrivateDownload.mockResolvedValue(
      'https://signed.test/doc',
    );

    await expect(
      service.upload(
        userId,
        propertyId,
        {
          buffer: Buffer.from('%PDF'),
          originalname: 'titre.pdf',
          mimetype: 'application/pdf',
        },
        { type: DocumentType.TITLE_DEED },
      ),
    ).resolves.toMatchObject({ url: 'https://signed.test/doc' });
    expect(prisma.propertyDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        propertyId,
        url: null,
        fileKey: document.fileKey,
      }),
    });
  });
});
