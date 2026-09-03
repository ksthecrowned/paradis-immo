import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BuyerPaymentProofsService } from './buyer-payment-proofs.service';
import { DOMAIN_EVENTS } from '../events/event.types';

describe('BuyerPaymentProofsService', () => {
  const agreement = {
    id: 'agreement-1',
    propertyId: 'property-1',
    buyerId: 'buyer-1',
    organizationId: 'org-1',
    status: 'ACTIVE',
    organization: { id: 'org-1', name: 'Paradis Immo' },
  };
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'proof-1',
    saleAgreementId: 'agreement-1',
    buyerUserId: 'buyer-1',
    requesterOrgId: 'org-1',
    status: 'PENDING',
    snapshot: null,
    respondedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-09-03T00:00:00Z'),
    organization: { name: 'Paradis Immo' },
    ...overrides,
  });

  let prisma: any;
  let agencyAccess: any;
  let events: any;
  let service: BuyerPaymentProofsService;

  beforeEach(() => {
    prisma = {
      saleAgreement: { findUnique: jest.fn().mockResolvedValue(agreement) },
      rentSchedule: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
      saleInstallment: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      paymentAllocation: { findFirst: jest.fn().mockResolvedValue(null) },
      buyerPaymentProof: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(row()),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    agencyAccess = { assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined) };
    events = { emit: jest.fn().mockResolvedValue(undefined) };
    service = new BuyerPaymentProofsService(prisma, agencyAccess, events);
  });

  it('creates PENDING and emits the domain event', async () => {
    const result = await service.create('manager-1', 'agreement-1');
    expect(result.status).toBe('PENDING');
    expect(result.snapshot).toBeNull();
    expect(events.emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED,
      expect.objectContaining({
        proofId: 'proof-1',
        buyerUserId: 'buyer-1',
        saleAgreementId: 'agreement-1',
        requesterOrgId: 'org-1',
        organizationName: 'Paradis Immo',
      }),
    );
  });

  it('rejects cancelled agreements and buyers without paid payments', async () => {
    prisma.saleAgreement.findUnique.mockResolvedValueOnce({
      ...agreement,
      status: 'CANCELLED',
    });
    await expect(service.create('manager-1', 'agreement-1')).rejects.toMatchObject({
      response: { code: 'AGREEMENT_CANCELLED' },
    });

    prisma.saleAgreement.findUnique.mockResolvedValueOnce(agreement);
    prisma.rentSchedule.count.mockResolvedValue(0);
    await expect(service.create('manager-1', 'agreement-1')).rejects.toMatchObject({
      response: { code: 'NO_PAID_PAYMENTS' },
    });
  });

  it('rejects a second pending proof', async () => {
    prisma.buyerPaymentProof.findFirst.mockResolvedValue(row());
    await expect(service.create('manager-1', 'agreement-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('translates a concurrent pending unique violation to PENDING_EXISTS', async () => {
    prisma.buyerPaymentProof.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.create('manager-1', 'agreement-1')).rejects.toMatchObject({
      response: { code: 'PENDING_EXISTS' },
    });
  });

  it('accepts mixed paid items, caps at three, and computes lateness', async () => {
    const created = await service.create('manager-1', 'agreement-1');
    let transitionedRow: any;
    prisma.buyerPaymentProof.findUnique.mockImplementation(async () => transitionedRow ?? row());
    prisma.rentSchedule.findMany.mockResolvedValue([
      {
        dueDate: new Date('2026-04-01T00:00:00Z'),
        amount: '100',
        currency: 'XAF',
        createdAt: new Date('2026-04-03T00:00:00Z'),
        payments: [{ payment: { status: 'VALIDATED', validatedAt: new Date('2026-04-03T00:00:00Z') } }],
      },
      {
        dueDate: new Date('2026-01-15T00:00:00Z'),
        amount: '150',
        currency: 'XAF',
        createdAt: new Date('2026-01-16T00:00:00Z'),
        payments: [],
      },
    ]);
    prisma.saleInstallment.findMany.mockResolvedValue([{
      dueDate: new Date('2026-03-15T00:00:00Z'),
      amount: '500',
      currency: 'XAF',
      createdAt: new Date('2026-03-14T00:00:00Z'),
      agreement: { buyerId: 'buyer-1' },
      payments: [],
    }, {
      dueDate: new Date('2026-02-15T00:00:00Z'),
      amount: '600',
      currency: 'XAF',
      createdAt: new Date('2026-02-14T00:00:00Z'),
      agreement: { buyerId: 'buyer-1' },
      payments: [],
    }]);
    prisma.buyerPaymentProof.updateMany.mockImplementationOnce(async ({ data }: any) => {
      transitionedRow = row({
        status: data.status,
        snapshot: data.snapshot,
        expiresAt: data.expiresAt,
        respondedAt: data.respondedAt,
      });
      return { count: 1 };
    });
    const result = await service.respond('buyer-1', created.id, true);
    expect(result.status).toBe('GRANTED');
    expect(result.snapshot).toHaveLength(3);
    expect(result.snapshot?.map((item) => item.dueDate)).toEqual([
      '2026-04-01',
      '2026-03-15',
      '2026-02-15',
    ]);
    expect(result.snapshot?.[0]).toMatchObject({ kind: 'RENT', dueDate: '2026-04-01', daysLate: 2 });
    expect(result.snapshot?.[1]).toMatchObject({ kind: 'SALE_INSTALLMENT', dueDate: '2026-03-15', daysLate: 0 });
    for (const item of result.snapshot ?? []) {
      expect(Object.keys(item).sort()).toEqual([
        'amount',
        'currency',
        'daysLate',
        'dueDate',
        'kind',
        'paidAt',
      ]);
      expect(item).not.toHaveProperty('saleAgreementId');
      expect(item).not.toHaveProperty('property');
      expect(item).not.toHaveProperty('propertyId');
      expect(item).not.toHaveProperty('title');
      expect(item).not.toHaveProperty('address');
    }
    expect((result.expiresAt && new Date(result.expiresAt).getTime())! - Date.now()).toBeGreaterThan(6 * 86_400_000);
  });

  it('denies and latestForAgreement returns DENIED without a snapshot', async () => {
    prisma.buyerPaymentProof.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: 'DENIED', respondedAt: new Date() }));
    prisma.buyerPaymentProof.updateMany.mockResolvedValue({ count: 1 });
    const denied = await service.respond('buyer-1', 'proof-1', false);
    expect(denied.snapshot).toBeNull();
    prisma.buyerPaymentProof.findFirst.mockResolvedValue(row({
      status: 'DENIED',
      snapshot: [{ kind: 'RENT' }],
      respondedAt: new Date(),
    }));
    const latest = await service.latestForAgreement('manager-1', 'agreement-1');
    expect(latest?.status).toBe('DENIED');
    expect(latest?.snapshot).toBeNull();
  });

  it('rejects a response when another response already transitioned the proof', async () => {
    prisma.buyerPaymentProof.findUnique.mockResolvedValue(row());
    prisma.buyerPaymentProof.updateMany
      .mockResolvedValueOnce({ count: 0 });

    await expect(service.respond('buyer-1', 'proof-1', true)).rejects.toMatchObject({
      response: { code: 'PROOF_NOT_PENDING' },
    });
  });

  it('lazily expires latest proofs without exposing snapshots', async () => {
    prisma.buyerPaymentProof.findFirst.mockResolvedValue(row({
      status: 'GRANTED',
      snapshot: [{ kind: 'RENT' }],
      expiresAt: new Date(Date.now() - 1000),
    }));
    prisma.buyerPaymentProof.update.mockResolvedValue(row({ status: 'EXPIRED', expiresAt: new Date(Date.now() - 1000) }));
    const latest = await service.latestForAgreement('manager-1', 'agreement-1');
    expect(latest?.status).toBe('EXPIRED');
    expect(latest?.snapshot).toBeNull();
  });

  it('lists buyer proofs with PENDING first and no snapshot leak', async () => {
    prisma.buyerPaymentProof.findMany.mockResolvedValue([
      row({
        id: 'proof-granted',
        status: 'GRANTED',
        snapshot: [{ kind: 'RENT' }],
        createdAt: new Date('2026-09-03T02:00:00Z'),
      }),
      row({
        id: 'proof-pending',
        status: 'PENDING',
        createdAt: new Date('2026-09-03T01:00:00Z'),
      }),
      row({
        id: 'proof-denied',
        status: 'DENIED',
        snapshot: [{ kind: 'RENT' }],
        createdAt: new Date('2026-09-03T00:00:00Z'),
      }),
    ]);
    const results = await service.listForBuyer('buyer-1');
    expect(results.map((proof) => proof.id)).toEqual([
      'proof-pending',
      'proof-granted',
      'proof-denied',
    ]);
    expect(results.every((proof) => proof.snapshot === null)).toBe(true);
  });

  it('only lets the buyer respond and managers operate their property', async () => {
    prisma.buyerPaymentProof.findUnique.mockResolvedValue(row());
    await expect(service.respond('stranger', 'proof-1', true)).rejects.toBeInstanceOf(NotFoundException);
    prisma.buyerPaymentProof.findFirst.mockResolvedValue(null);
    await service.latestForAgreement('manager-1', 'agreement-1');
    expect(agencyAccess.assertCanOperateOnProperty).toHaveBeenCalledWith('manager-1', 'property-1');
  });
});
