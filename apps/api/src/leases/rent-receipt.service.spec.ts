import { DocumentSequenceService } from '../documents/document-sequence.service';
import { R2Service } from '../media/r2.service';
import { PrismaService } from '../prisma/prisma.service';
import { RentReceiptService } from './rent-receipt.service';

describe('RentReceiptService', () => {
  it('repairs a missing legacy PDF on retry and moves its key to private storage', async () => {
    const receipt = {
      id: 'receipt-1',
      number: 'Q-ORG-2026-000001',
      rentScheduleId: 'schedule-1',
      issuerOrgId: 'org-1',
      fileKey: 'quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
      issuedAt: new Date('2026-01-05T00:00:00Z'),
    };
    const schedule = {
      id: 'schedule-1',
      leaseId: 'lease-1',
      dueDate: new Date('2026-01-01T00:00:00Z'),
      periodStart: null,
      periodEnd: null,
      rentPart: { toString: () => '1000' },
      chargesPart: { toString: () => '100' },
      amount: { toString: () => '1100' },
      currency: 'XAF',
      receipt,
      lease: {
        tenant: { name: 'Locataire', phone: '+242000000000' },
        invitedPhone: null,
        property: {
          address: 'Brazzaville',
          ownerId: 'owner-1',
          organizationId: 'org-1',
          organization: { id: 'org-1', name: 'Agence' },
        },
        coTenants: [],
      },
    };
    const prisma = {
      rentSchedule: { findUnique: jest.fn().mockResolvedValue(schedule) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Bailleur' }) },
      rentReceipt: {
        update: jest.fn().mockResolvedValue({
          ...receipt,
          fileKey:
            'private/quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
        }),
      },
    } as unknown as PrismaService;
    const r2 = {
      uploadPrivateFileAtKey: jest.fn().mockResolvedValue(undefined),
    } as unknown as R2Service;
    const service = new RentReceiptService(
      prisma,
      r2,
      {} as DocumentSequenceService,
    );

    const result = await service.issueForRentSchedule('schedule-1');

    expect(r2.uploadPrivateFileAtKey).toHaveBeenCalledWith(
      'private/quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(prisma.rentReceipt.update).toHaveBeenCalledWith({
      where: { id: 'receipt-1' },
      data: {
        fileKey: 'private/quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
      },
    });
    expect(result.fileKey).toBe(
      'private/quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
    );
  });

  it('surfaces storage failures so callers can retry the same receipt', async () => {
    const receipt = {
      id: 'receipt-1',
      number: 'Q-ORG-2026-000001',
      rentScheduleId: 'schedule-1',
      issuerOrgId: 'org-1',
      fileKey: 'private/quittances/lease-1/schedule-1/Q-ORG-2026-000001.pdf',
      issuedAt: new Date('2026-01-05T00:00:00Z'),
    };
    const prisma = {
      rentSchedule: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'schedule-1',
          leaseId: 'lease-1',
          dueDate: new Date('2026-01-01T00:00:00Z'),
          periodStart: null,
          periodEnd: null,
          rentPart: { toString: () => '1000' },
          chargesPart: { toString: () => '100' },
          amount: { toString: () => '1100' },
          currency: 'XAF',
          receipt,
          lease: {
            tenant: { name: 'Locataire', phone: '+242000000000' },
            invitedPhone: null,
            property: {
              address: 'Brazzaville',
              ownerId: 'owner-1',
              organizationId: 'org-1',
              organization: { id: 'org-1', name: 'Agence' },
            },
            coTenants: [],
          },
        }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Bailleur' }) },
    } as unknown as PrismaService;
    const r2 = {
      uploadPrivateFileAtKey: jest
        .fn()
        .mockRejectedValue(new Error('R2 unavailable')),
    } as unknown as R2Service;
    const service = new RentReceiptService(
      prisma,
      r2,
      {} as DocumentSequenceService,
    );

    await expect(service.issueForRentSchedule('schedule-1')).rejects.toThrow(
      'R2 unavailable',
    );
  });

  it('allows a listed co-tenant to read a quittance without manager access', async () => {
    const prisma = {
      rentSchedule: {
        findUnique: jest.fn().mockResolvedValue({
          lease: {
            id: 'lease-1',
            tenantId: 'primary-tenant',
            propertyId: 'property-1',
            coTenants: [{ userId: 'co-tenant' }],
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new RentReceiptService(
      prisma,
      {} as R2Service,
      {} as DocumentSequenceService,
    );
    const canOperate = jest.fn();

    const result = await service.assertCanReadSchedule(
      'co-tenant',
      'schedule-1',
      canOperate,
    );

    expect(result.leaseId).toBe('lease-1');
    expect(canOperate).not.toHaveBeenCalled();
  });

  it('requires property-management access for an unrelated user', async () => {
    const prisma = {
      rentSchedule: {
        findUnique: jest.fn().mockResolvedValue({
          lease: {
            id: 'lease-1',
            tenantId: 'primary-tenant',
            propertyId: 'property-1',
            coTenants: [],
          },
        }),
      },
    } as unknown as PrismaService;
    const service = new RentReceiptService(
      prisma,
      {} as R2Service,
      {} as DocumentSequenceService,
    );
    const canOperate = jest.fn().mockRejectedValue(new Error('forbidden'));

    await expect(
      service.assertCanReadSchedule('outsider', 'schedule-1', canOperate),
    ).rejects.toThrow('forbidden');
    expect(canOperate).toHaveBeenCalledWith('outsider', 'property-1');
  });
});
