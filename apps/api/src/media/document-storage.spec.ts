import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from './r2.service';
import { LeaseDocumentsService } from '../leases/lease-documents.service';
import { TenantDocumentsService } from '../tenants/tenant-documents.service';

describe('Private tenant and lease documents', () => {
  const tenantId = 'tenant-1';
  const key = 'private/document.pdf';
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  const r2 = {
    createPresignedDownload: jest.fn(
      async (fileKey: string) => `https://signed.test/${fileKey}`,
    ),
    uploadPrivateTenantFile: jest.fn(async () => ({ key })),
    uploadPrivateLeaseFile: jest.fn(async () => ({ key })),
    deletePrivateObject: jest.fn(async () => undefined),
    keyFromPublicUrl: jest.fn(() => null),
    deleteObject: jest.fn(async () => undefined),
  };
  const agencyAccess = {
    assertCanOperateOnProperty: jest.fn(async () => undefined),
    listOperablePropertyIds: jest.fn(async () => ['property-1']),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs tenant document keys and hides legacy public URLs', async () => {
    const prisma = {
      tenantDocument: {
        findMany: jest.fn(async () => [
          {
            id: 'private-doc',
            userId: tenantId,
            type: 'ID_CARD',
            url: null,
            fileKey: key,
            name: 'ID',
            uploadedBy: 'manager-1',
            createdAt: timestamp,
          },
          {
            id: 'legacy-doc',
            userId: tenantId,
            type: 'ID_CARD',
            url: 'https://public.test/legacy.pdf',
            fileKey: null,
            name: 'Old ID',
            uploadedBy: 'manager-1',
            createdAt: timestamp,
          },
        ]),
      },
    };
    const service = new TenantDocumentsService(
      prisma as unknown as PrismaService,
      agencyAccess as unknown as AgencyAccessService,
      r2 as unknown as R2Service,
    );

    await expect(service.listMine(tenantId)).resolves.toMatchObject([
      { id: 'private-doc', url: `https://signed.test/${key}` },
      { id: 'legacy-doc', url: null },
    ]);
  });

  it('signs lease document keys only for an authorized tenant', async () => {
    const prisma = {
      lease: {
        findUnique: jest.fn(async () => ({
          tenantId,
          propertyId: 'property-1',
        })),
      },
      leaseDocument: {
        findMany: jest.fn(async () => [
          {
            id: 'lease-doc',
            leaseId: 'lease-1',
            type: 'SIGNED_LEASE',
            url: null,
            fileKey: key,
            name: 'Lease',
            uploadedBy: 'manager-1',
            createdAt: timestamp,
          },
        ]),
      },
    };
    const service = new LeaseDocumentsService(
      prisma as unknown as PrismaService,
      agencyAccess as unknown as AgencyAccessService,
      r2 as unknown as R2Service,
    );

    await expect(service.list(tenantId, 'lease-1')).resolves.toMatchObject([
      { id: 'lease-doc', url: `https://signed.test/${key}` },
    ]);
    expect(agencyAccess.assertCanOperateOnProperty).not.toHaveBeenCalled();
  });
});
