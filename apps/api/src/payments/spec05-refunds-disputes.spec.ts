import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PaymentsService } from './payments.service';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { RentReceiptService } from '../leases/rent-receipt.service';
import { ReceiptService } from './receipts/receipt.service';
import { R2Service } from '../media/r2.service';

/**
 * Spec 05 P1 — remboursements (seuil d'approbation, inversion des
 * allocations, écriture `REFUND` du grand livre) et litiges (ouverture 30 j,
 * escalade 72 h, résolution, retour du paiement à VALIDATED).
 */
describe('PaymentsService — spec 05 P1 (remboursements & litiges)', () => {
  let payments: PaymentsService;
  let prisma: PrismaService;
  let events: { emit: jest.Mock };
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let strangerUserId: string;
  let adminUserId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let leaseId: string;
  let schedFullId: string;
  let schedPartialId: string;
  let schedDisputeId: string;
  let schedOldId: string;
  let schedInitiatedId: string;
  let pFullId: string;
  let pPartId: string;
  let pDispId: string;
  let pOldId: string;
  let pInitId: string;
  const createdPaymentIds: string[] = [];
  const phones = {
    owner: '+242070000161',
    tenant: '+242070000162',
    stranger: '+242070000163',
    admin: '+242070000164',
  };

  beforeAll(async () => {
    events = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        AgencyAccessService,
        CashProvider,
        MobileMoneyProvider,
        PrismaService,
        DocumentSequenceService,
        RentReceiptService,
        ReceiptService,
        { provide: EventPublisher, useValue: events },
        {
          provide: R2Service,
          useValue: {
            uploadBuffer: jest.fn(async (key: string) => ({
              url: `https://fake.r2/${key}`,
              key,
            })),
            uploadLeaseFile: jest.fn(async (key: string) => ({
              url: `https://fake.r2/${key}`,
              key,
            })),
            createPresignedDownload: jest.fn(async (key: string) => key),
          },
        },
      ],
    }).compile();

    payments = moduleRef.get(PaymentsService);
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

    // Purge leftovers of a previous crashed run (unique (phone, countryId)).
    const stale = await prisma.user.findMany({
      where: { phone: { in: Object.values(phones) } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.paymentAllocation.deleteMany({
        where: { payment: { userId: { in: staleIds } } },
      });
      await prisma.receipt.deleteMany({
        where: { payment: { userId: { in: staleIds } } },
      });
      await prisma.payment.deleteMany({ where: { userId: { in: staleIds } } });
      const staleLeases = await prisma.lease.findMany({
        where: { tenantId: { in: staleIds } },
        select: { id: true },
      });
      const staleLeaseIds = staleLeases.map((l) => l.id);
      if (staleLeaseIds.length) {
        await prisma.rentReceipt.deleteMany({
          where: { rentSchedule: { leaseId: { in: staleLeaseIds } } },
        });
        await prisma.rentSchedule.deleteMany({
          where: { leaseId: { in: staleLeaseIds } },
        });
        await prisma.lease.deleteMany({ where: { id: { in: staleLeaseIds } } });
      }
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = (phone: string, name: string, role = 'TENANT') =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec051 Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec051 Tenant')).id;
    strangerUserId = (await mk(phones.stranger, 'Spec051 Stranger')).id;
    adminUserId = (await mk(phones.admin, 'Spec051 Admin', 'PLATFORM_ADMIN')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec051 Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        refundApprovalThreshold: 100000,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = org.id;
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec051 Property',
          description: 'Remboursements et litiges',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec051',
          countryId,
          ownerId: ownerUserId,
          organizationId: ownerOrgId,
        },
      })
    ).id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        currency: 'XAF',
        status: 'ACTIVE',
        monthlyRent: 150000,
        deposit: 300000,
      },
    });
    leaseId = lease.id;

    const mkSchedule = (dueDate: string) =>
      prisma.rentSchedule.create({
        data: {
          leaseId,
          dueDate: new Date(dueDate),
          amount: 150000,
          currency: 'XAF',
          status: 'PENDING',
        },
      });
    schedFullId = (await mkSchedule('2026-02-01T00:00:00Z')).id;
    schedPartialId = (await mkSchedule('2026-03-01T00:00:00Z')).id;
    schedDisputeId = (await mkSchedule('2026-04-01T00:00:00Z')).id;
    schedOldId = (await mkSchedule('2026-05-01T00:00:00Z')).id;
    schedInitiatedId = (await mkSchedule('2026-06-01T00:00:00Z')).id;

    // Cash payments validated by the property owner (= manager here).
    const cash = async (label: string) => {
      const p = await payments.recordCashPayment(ownerUserId, {
        rentScheduleId: { full: schedFullId, part: schedPartialId, disp: schedDisputeId, old: schedOldId }[
          label as 'full' | 'part' | 'disp' | 'old'
        ],
        idempotencyKey: `spec051-${label}-${Date.now()}`,
      });
      createdPaymentIds.push(p.id);
      return p.id;
    };
    pFullId = await cash('full');
    pPartId = await cash('part');
    pDispId = await cash('disp');
    pOldId = await cash('old');
    // Backdate so the 30-day dispute window is closed for this one.
    await prisma.payment.update({
      where: { id: pOldId },
      data: { createdAt: new Date(Date.now() - 31 * 86_400_000) },
    });

    // An INITIATED mobile money payment (never validated).
    const initiated = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: `spec051-initiated-${Date.now()}`,
      target: { type: 'RENT_SCHEDULE', id: schedInitiatedId },
    });
    createdPaymentIds.push(initiated.id);
    pInitId = initiated.id;
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.paymentAllocation
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
    }
    // Refund / dispute rows cascade with their payment.
    await prisma.payment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    if (propertyId) {
      await prisma.ledgerEntry
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
    }
    if (leaseId) {
      await prisma.paymentAllocation
        .deleteMany({ where: { rentSchedule: { leaseId } } })
        .catch(() => undefined);
      await prisma.rentReceipt
        .deleteMany({ where: { rentSchedule: { leaseId } } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId } })
        .catch(() => undefined);
      await prisma.lease
        .delete({ where: { id: leaseId } })
        .catch(() => undefined);
    }
    const ids = [ownerUserId, tenantUserId, strangerUserId, adminUserId].filter(
      Boolean,
    );
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.property
      .delete({ where: { id: propertyId } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.organization
      .delete({ where: { id: ownerOrgId } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  describe('garde-fous', () => {
    it('refuses a refund to a non-manager and on a non-validated payment', async () => {
      await expect(
        payments.createRefund(strangerUserId, pFullId, {
          reason: 'escroc',
          method: 'PROVIDER',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYMENT_FORBIDDEN' },
      });

      await expect(
        payments.createRefund(ownerUserId, pInitId, {
          reason: 'pas encore payé',
          method: 'PROVIDER',
        }),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_NOT_REFUNDABLE' } });
    });

    it('refuses a dispute to a non-payer, on INITIATED and outside 30 days', async () => {
      await expect(
        payments.openDispute(strangerUserId, pDispId, {
          reason: 'OTHER',
          description: 'je ne suis pas le payeur',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYMENT_FORBIDDEN' },
      });

      await expect(
        payments.openDispute(tenantUserId, pInitId, {
          reason: 'NOT_CREDITED',
          description: 'pas encore confirmé',
        }),
      ).rejects.toMatchObject({ response: { code: 'DISPUTE_NOT_ALLOWED' } });

      await expect(
        payments.openDispute(tenantUserId, pOldId, {
          reason: 'DUPLICATE',
          description: 'trop tard',
        }),
      ).rejects.toMatchObject({ response: { code: 'DISPUTE_WINDOW_CLOSED' } });
    });
  });

  describe('remboursements', () => {
    let overThresholdRefundId: string;

    it('a refund above the threshold waits for a platform admin', async () => {
      events.emit.mockClear();
      // 150 000 > 100 000 (org.refundApprovalThreshold) → REQUESTED.
      const refund = await payments.createRefund(ownerUserId, pFullId, {
        reason: 'doublon de prélèvement',
        method: 'PROVIDER',
      });
      overThresholdRefundId = refund.id;
      expect(refund.status).toBe('REQUESTED');
      expect(refund.amount).toBe('150000');

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pFullId },
      });
      expect(payment.status).toBe('VALIDATED');
      expect(payment.refundedAmount.toNumber()).toBe(0);

      // Only a platform admin can decide.
      await expect(
        payments.decideRefund(ownerUserId, refund.id, { decision: 'APPROVE' }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'NOT_PLATFORM_ADMIN' },
      });

      const rejected = await payments.decideRefund(adminUserId, refund.id, {
        decision: 'REJECT',
        comment: 'preuve manquante',
      });
      expect(rejected.status).toBe('REJECTED');
      const stillValidated = await prisma.payment.findUniqueOrThrow({
        where: { id: pFullId },
      });
      expect(stillValidated.status).toBe('VALIDATED');
      expect(
        await prisma.ledgerEntry.findFirst({
          where: { sourceType: 'REFUND', sourceId: refund.id },
        }),
      ).toBeNull();
    });

    it('an approved refund executes: schedule back to PENDING + ledger REFUND', async () => {
      events.emit.mockClear();
      const refund = await payments.createRefund(ownerUserId, pFullId, {
        reason: 'doublon de prélèvement',
        method: 'PROVIDER',
      });
      expect(refund.status).toBe('REQUESTED');

      const decided = await payments.decideRefund(adminUserId, refund.id, {
        decision: 'APPROVE',
      });
      expect(decided.status).toBe('SUCCEEDED');
      expect(decided.providerRef).toMatch(/^rfb-/);
      expect(decided.approvedById).toBe(adminUserId);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pFullId },
        include: { allocations: true },
      });
      expect(payment.status).toBe('REFUNDED');
      expect(payment.refundedAmount.toNumber()).toBe(150000);
      expect(payment.allocations).toHaveLength(0);

      const schedule = await prisma.rentSchedule.findUniqueOrThrow({
        where: { id: schedFullId },
      });
      expect(schedule.status).toBe('PENDING');
      expect(schedule.amountPaid.toNumber()).toBe(0);

      const ledger = await prisma.ledgerEntry.findFirst({
        where: { sourceType: 'REFUND', sourceId: refund.id, type: 'REFUND' },
      });
      expect(ledger).not.toBeNull();
      expect(ledger!.amount.toNumber()).toBe(-150000);
      expect(ledger!.ownerOrgId).toBe(ownerOrgId);
      expect(ledger!.propertyId).toBe(propertyId);

      const refunded = events.emit.mock.calls.filter(
        (call) => call[0] === 'payment.refunded',
      );
      expect(refunded).toHaveLength(1);
      expect(refunded[0][1]).toMatchObject({
        paymentId: pFullId,
        refundId: refund.id,
        amount: '150000',
      });

      // Deciding twice on the same refund is refused.
      await expect(
        payments.decideRefund(adminUserId, refund.id, { decision: 'APPROVE' }),
      ).rejects.toMatchObject({ response: { code: 'REFUND_ALREADY_DECIDED' } });
    });

    it('a below-threshold refund executes immediately, partial then full', async () => {
      // Partial: 60 000 ≤ 100 000 → executed directly.
      const partial = await payments.createRefund(ownerUserId, pPartId, {
        amount: 60000,
        reason: 'mois annulé',
        method: 'PROVIDER',
      });
      expect(partial.status).toBe('SUCCEEDED');

      let payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pPartId },
        include: { allocations: true },
      });
      expect(payment.status).toBe('PARTIALLY_REFUNDED');
      expect(payment.refundedAmount.toNumber()).toBe(60000);
      expect(payment.allocations).toHaveLength(1);
      expect(payment.allocations[0].amount.toNumber()).toBe(90000);

      let schedule = await prisma.rentSchedule.findUniqueOrThrow({
        where: { id: schedPartialId },
      });
      expect(schedule.status).toBe('PARTIAL');
      expect(schedule.amountPaid.toNumber()).toBe(90000);

      // Guards: over the remaining balance, then cash without proof.
      await expect(
        payments.createRefund(ownerUserId, pPartId, {
          amount: 95000,
          reason: 'trop',
          method: 'PROVIDER',
        }),
      ).rejects.toMatchObject({ response: { code: 'REFUND_EXCEEDS_BALANCE' } });

      await expect(
        payments.createRefund(ownerUserId, pPartId, {
          amount: 10000,
          reason: 'espèces',
          method: 'CASH',
        }),
      ).rejects.toMatchObject({ response: { code: 'REFUND_PROOF_REQUIRED' } });

      const cashRefund = await payments.createRefund(ownerUserId, pPartId, {
        amount: 10000,
        reason: 'espèces remis en main propre',
        method: 'CASH',
        proofKey: 'proofs/spec051-cash-refund.pdf',
      });
      expect(cashRefund.status).toBe('SUCCEEDED');
      expect(cashRefund.proofKey).toBe('proofs/spec051-cash-refund.pdf');
      expect(cashRefund.providerRef).toBeNull();

      // Reste : 80 000 → remboursement total du solde.
      const rest = await payments.createRefund(ownerUserId, pPartId, {
        reason: 'solde restant',
        method: 'PROVIDER',
      });
      expect(rest.status).toBe('SUCCEEDED');

      payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pPartId },
        include: { allocations: true },
      });
      expect(payment.status).toBe('REFUNDED');
      expect(payment.refundedAmount.toNumber()).toBe(150000);
      expect(payment.allocations).toHaveLength(0);

      schedule = await prisma.rentSchedule.findUniqueOrThrow({
        where: { id: schedPartialId },
      });
      expect(schedule.status).toBe('PENDING');
      expect(schedule.amountPaid.toNumber()).toBe(0);

      // Nothing left to refund.
      await expect(
        payments.createRefund(ownerUserId, pPartId, {
          reason: 'encore',
          method: 'PROVIDER',
        }),
      ).rejects.toMatchObject({ response: { code: 'PAYMENT_NOT_REFUNDABLE' } });
    });
  });

  describe('litiges', () => {
    let disputeId: string;

    it('the payer opens a dispute: payment → DISPUTED + event', async () => {
      events.emit.mockClear();
      const dispute = await payments.openDispute(tenantUserId, pDispId, {
        reason: 'NOT_CREDITED',
        description: 'Débité mais rien reçu sur le compte du propriétaire',
        evidenceKeys: ['evidence/spec051-sms.png'],
      });
      disputeId = dispute.id;
      expect(dispute.status).toBe('OPEN');
      expect(dispute.evidenceKeys).toEqual(['evidence/spec051-sms.png']);

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pDispId },
      });
      expect(payment.status).toBe('DISPUTED');

      const disputed = events.emit.mock.calls.filter(
        (call) => call[0] === 'payment.disputed',
      );
      expect(disputed).toHaveLength(1);
      expect(disputed[0][1]).toMatchObject({
        paymentId: pDispId,
        disputeId: dispute.id,
        openedBy: tenantUserId,
        reason: 'NOT_CREDITED',
      });

      // A second open dispute on the same payment is refused.
      await expect(
        payments.openDispute(tenantUserId, pDispId, {
          reason: 'DUPLICATE',
          description: 'encore un litige',
        }),
      ).rejects.toMatchObject({ response: { code: 'DISPUTE_ALREADY_OPEN' } });
    });

    it('an unanswered dispute escalates to the admin after 72 h', async () => {
      await prisma.paymentDispute.update({
        where: { id: disputeId },
        data: { createdAt: new Date(Date.now() - 73 * 3_600_000) },
      });
      const result = await payments.escalateOverdueDisputes();
      expect(result.escalated).toBeGreaterThanOrEqual(1);

      const row = await prisma.paymentDispute.findUniqueOrThrow({
        where: { id: disputeId },
      });
      expect(row.status).toBe('ESCALATED');
    });

    it('resolution rights and status guards', async () => {
      await expect(
        payments.resolveDispute(strangerUserId, disputeId, {
          status: 'RESOLVED_REJECTED',
        }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYMENT_FORBIDDEN' },
      });

      await expect(
        payments.resolveDispute(ownerUserId, disputeId, {
          status: 'RESOLVED_DONE',
        }),
      ).rejects.toMatchObject({ response: { code: 'DISPUTE_INVALID_STATUS' } });
    });

    it('refusing the contestation returns the payment to VALIDATED', async () => {
      const resolved = await payments.resolveDispute(ownerUserId, disputeId, {
        status: 'RESOLVED_REJECTED',
        resolution: 'Le paiement est bien crédité sur le relevé',
      });
      expect(resolved.status).toBe('RESOLVED_REJECTED');
      expect(resolved.resolvedById).toBe(ownerUserId);
      expect(resolved.resolvedAt).not.toBeNull();

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: pDispId },
      });
      expect(payment.status).toBe('VALIDATED');
    });

    it('a refund runs while the reopened dispute is pending, then accept it', async () => {
      // The contestation can be reopened once resolved.
      const reopened = await payments.openDispute(tenantUserId, pDispId, {
        reason: 'NOT_CREDITED',
        description: 'Toujours pas crédité',
      });
      expect(reopened.status).toBe('OPEN');
      const paymentBefore = await prisma.payment.findUniqueOrThrow({
        where: { id: pDispId },
      });
      expect(paymentBefore.status).toBe('DISPUTED');

      // Refunds stay allowed on a DISPUTED payment (spec: remboursement).
      const refund = await payments.createRefund(ownerUserId, pDispId, {
        amount: 50000,
        reason: 'gestionnaire convaincu par la contestation',
        method: 'PROVIDER',
      });
      expect(refund.status).toBe('SUCCEEDED');
      const afterRefund = await prisma.payment.findUniqueOrThrow({
        where: { id: pDispId },
      });
      expect(afterRefund.status).toBe('PARTIALLY_REFUNDED');
      expect(afterRefund.refundedAmount.toNumber()).toBe(50000);

      const accepted = await payments.resolveDispute(ownerUserId, reopened.id, {
        status: 'RESOLVED_ACCEPTED',
        resolution: 'Remboursement partiel effectué',
      });
      expect(accepted.status).toBe('RESOLVED_ACCEPTED');
      const finalPayment = await prisma.payment.findUniqueOrThrow({
        where: { id: pDispId },
      });
      expect(finalPayment.status).toBe('PARTIALLY_REFUNDED');
    });

    it('dispute listings: manager scope vs admin, stranger sees nothing', async () => {
      const forOwner = await payments.listManagedDisputes(ownerUserId);
      expect(forOwner.map((d) => d.paymentId)).toContain(pDispId);

      const forStranger = await payments.listManagedDisputes(strangerUserId);
      expect(forStranger).toHaveLength(0);

      const forAdmin = await payments.listManagedDisputes(adminUserId);
      expect(forAdmin.map((d) => d.paymentId)).toContain(pDispId);
    });
  });
});
