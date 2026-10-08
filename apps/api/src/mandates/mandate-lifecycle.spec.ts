import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';
import { AgencyAccessService } from './agency-access.service';
import { RentScheduleGenerator } from '../leases/rent-schedule.generator.service';
import { R2Service } from '../media/r2.service';
import { OtpStore } from '../auth/otp.store';
import { InfobipOtpService } from '../auth/infobip-otp.service';

describe('Spec 03 — mandate lifecycle, termination and approval effects', () => {
  let mandates: MandatesService;
  let approvals: MandateApprovalService;
  let access: AgencyAccessService;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let tenantUserId: string;
  let ownerOrgId: string;
  let agencyOrgId: string;
  let propertyId: string;
  let secondPropertyId: string;
  let mandateId: string;
  let activeLeaseId: string;
  let draftLeaseId: string;
  let otpStore: OtpStore;
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];

  const createdApprovalIds: string[] = [];

  beforeAll(async () => {
    const eventBus: Pick<EventPublisher, 'emit'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      emit: jest.fn(async (name, payload) => {
        emittedEvents.push({ name, payload });
        return { id: 'mock', name };
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MandatesService,
        MandateApprovalService,
        AgencyAccessService,
        PrismaService,
        RentScheduleGenerator,
        OtpStore,
        {
          provide: R2Service,
          useValue: {
            uploadLeaseFile: jest.fn(async () => ({
              url: 'https://fake.r2/avenant.pdf',
              key: 'avenant.pdf',
            })),
            uploadPrivateFile: jest.fn(async (p: { filename: string }) => ({
              url: `https://fake.r2/${p.filename}`,
              key: `private/${p.filename}`,
            })),
          },
        },
        { provide: InfobipOtpService, useValue: { sendText: jest.fn() } },
        { provide: EventPublisher, useValue: eventBus },
      ],
    }).compile();
    mandates = moduleRef.get(MandatesService);
    approvals = moduleRef.get(MandateApprovalService);
    access = moduleRef.get(AgencyAccessService);
    otpStore = moduleRef.get(OtpStore);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    quartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: ['+242072300001', '+242072300002', '+242072300003'] } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      const staleProps = await prisma.property.findMany({
        where: { ownerId: { in: staleIds } },
        select: { id: true },
      });
      const stalePropIds = staleProps.map((p) => p.id);
      if (stalePropIds.length) {
        const staleLeases = await prisma.lease.findMany({
          where: { propertyId: { in: stalePropIds } },
          select: { id: true },
        });
        const staleLeaseIds = staleLeases.map((l) => l.id);
        if (staleLeaseIds.length) {
          await prisma.paymentAllocation.deleteMany({
            where: { rentSchedule: { leaseId: { in: staleLeaseIds } } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { leaseId: { in: staleLeaseIds } },
          });
          await prisma.lease.deleteMany({
            where: { id: { in: staleLeaseIds } },
          });
        }
        await prisma.property.deleteMany({
          where: { id: { in: stalePropIds } },
        });
      }
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: { phone: '+242072300001', countryId, name: 'Lifecycle Owner' },
    });
    ownerUserId = owner.id;
    const gerant = await prisma.user.create({
      data: { phone: '+242072300002', countryId, name: 'Lifecycle Gérant' },
    });
    gerantUserId = gerant.id;
    const tenant = await prisma.user.create({
      data: { phone: '+242072300003', countryId, name: 'Lifecycle Tenant' },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Lifecycle Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Lifecycle Agency Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: gerantUserId, role: 'ADMIN' } },
      },
    });
    agencyOrgId = agencyOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Lifecycle Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    propertyId = prop.id;

    // Propose + accept through the service (spec 03 flow).
    const proposed = await mandates.createMandate(ownerUserId, {
      propertyId,
      organizationId: agencyOrgId,
      scopes: ['LONG_TERM_RENTAL'],
      managementFeeRate: 0.08,
      approvalTtlDays: 7,
      noticeDays: 30,
    });
    mandateId = proposed.id;
    await mandates.acceptMandate(gerantUserId, mandateId);

    // ACTIVE lease with three monthly PENDING schedule rows.
    const activeLease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 150000,
        deposit: 150000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    activeLeaseId = activeLease.id;
    await prisma.rentSchedule.createMany({
      data: [
        { leaseId: activeLeaseId, dueDate: new Date('2026-09-01'), amount: 150000, currency: 'XAF' },
        { leaseId: activeLeaseId, dueDate: new Date('2026-11-01'), amount: 150000, currency: 'XAF' },
        { leaseId: activeLeaseId, dueDate: new Date('2026-12-01'), amount: 150000, currency: 'XAF' },
      ],
    });

    // DRAFT lease used by the LEASE_SIGN effect test.
    const draft = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        monthlyRent: 120000,
        deposit: 120000,
        currency: 'XAF',
        status: 'DRAFT',
      },
    });
    draftLeaseId = draft.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdApprovalIds.length) {
      await prisma.mandateApproval
        .deleteMany({ where: { id: { in: createdApprovalIds } } })
        .catch(() => undefined);
    }
    const userIds = [ownerUserId, gerantUserId, tenantUserId].filter(Boolean);
    if (propertyId) {
      // Any mandate on this property (original + test-created proposals).
      await prisma.mandateApproval
        .deleteMany({ where: { mandate: { propertyId } } })
        .catch(() => undefined);
      await prisma.mandate
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
    }
    if (secondPropertyId) {
      await prisma.mandateApproval
        .deleteMany({ where: { mandate: { propertyId: secondPropertyId } } })
        .catch(() => undefined);
      await prisma.mandate
        .deleteMany({ where: { propertyId: secondPropertyId } })
        .catch(() => undefined);
      await prisma.property
        .deleteMany({ where: { id: secondPropertyId } })
        .catch(() => undefined);
    }
    if (propertyId) {
      const leases = await prisma.lease.findMany({
        where: { propertyId },
        select: { id: true },
      });
      const leaseIds = leases.map((l) => l.id);
      if (leaseIds.length) {
        await prisma.paymentAllocation.deleteMany({
          where: { rentSchedule: { leaseId: { in: leaseIds } } },
        });
        await prisma.rentSchedule.deleteMany({
          where: { leaseId: { in: leaseIds } },
        });
        await prisma.leaseDocument.deleteMany({
          where: { leaseId: { in: leaseIds } },
        });
        await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
      }
      await prisma.property.deleteMany({ where: { id: propertyId } });
    }
    if (userIds.length) {
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const orgIds = [ownerOrgId, agencyOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    emittedEvents.length = 0;
  });

  // ---------------------------------------------------------------------
  // Approbations — effets réels (P0)
  // ---------------------------------------------------------------------

  it('RENT_REDUCTION approval rewrites the lease and pending schedules, creates the avenant', async () => {
    const approval = await approvals.createApproval(gerantUserId, mandateId, {
      actionType: 'RENT_REDUCTION',
      sourceType: 'LEASE',
      sourceId: activeLeaseId,
      payload: {
        leaseId: activeLeaseId,
        newMonthlyRent: 130000,
        effectiveFrom: '2026-11-01',
        previousMonthlyRent: 150000,
        currency: 'XAF',
      },
    });
    createdApprovalIds.push(approval.id);
    expect(approval.status).toBe('PENDING');
    expect(approval.requestedById).toBe(gerantUserId);
    expect(new Date(approval.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const decided = await approvals.decideApproval(ownerUserId, approval.id, {
      decision: 'APPROVE',
      comment: 'OK pour la baisse',
    });
    expect(decided.status).toBe('APPROVED');
    expect(decided.appliedAt).not.toBeNull();
    expect(decided.comment).toBe('OK pour la baisse');

    const lease = await prisma.lease.findUniqueOrThrow({
      where: { id: activeLeaseId },
    });
    expect(lease.monthlyRent.toString()).toBe('130000');

    const schedules = await prisma.rentSchedule.findMany({
      where: { leaseId: activeLeaseId },
      orderBy: { dueDate: 'asc' },
    });
    // September (before effectiveFrom) untouched, Nov+Dec rewritten.
    expect(schedules[0].amount.toString()).toBe('150000');
    expect(schedules[1].amount.toString()).toBe('130000');
    expect(schedules[2].amount.toString()).toBe('130000');

    const amendments = await prisma.leaseDocument.findMany({
      where: { leaseId: activeLeaseId, type: 'AMENDMENT' },
    });
    expect(amendments.length).toBe(1);
    expect(amendments[0].url).toContain('avenant');

    expect(
      emittedEvents.find((e) => e.name === 'mandate.action.decided'),
    ).toBeDefined();
  });

  it('REJECT leaves the rent untouched and records the comment for the agent', async () => {
    const approval = await approvals.createApproval(gerantUserId, mandateId, {
      actionType: 'RENT_REDUCTION',
      payload: {
        leaseId: activeLeaseId,
        newMonthlyRent: 100000,
        effectiveFrom: '2026-12-01',
      },
    });
    createdApprovalIds.push(approval.id);

    const decided = await approvals.decideApproval(ownerUserId, approval.id, {
      decision: 'REJECT',
      comment: 'Trop bas',
    });
    expect(decided.status).toBe('REJECTED');
    expect(decided.comment).toBe('Trop bas');

    const lease = await prisma.lease.findUniqueOrThrow({
      where: { id: activeLeaseId },
    });
    expect(lease.monthlyRent.toString()).toBe('130000');
    const dec = await prisma.leaseDocument.count({
      where: { leaseId: activeLeaseId, type: 'AMENDMENT' },
    });
    expect(dec).toBe(1);
  });

  it('LEASE_SIGN approval activates the draft lease and generates its schedule', async () => {
    const approval = await approvals.createApproval(gerantUserId, mandateId, {
      actionType: 'LEASE_SIGN',
      sourceType: 'LEASE',
      sourceId: draftLeaseId,
      payload: { leaseId: draftLeaseId },
    });
    createdApprovalIds.push(approval.id);

    await approvals.decideApproval(ownerUserId, approval.id, {
      approve: true,
    });

    const lease = await prisma.lease.findUniqueOrThrow({
      where: { id: draftLeaseId },
    });
    expect(lease.status).toBe('ACTIVE');
    const schedules = await prisma.rentSchedule.count({
      where: { leaseId: draftLeaseId },
    });
    expect(schedules).toBeGreaterThan(0);
    expect(emittedEvents.find((e) => e.name === 'lease.created')).toBeDefined();
  });

  it('rejects invalid payloads at creation (400 INVALID_APPROVAL_PAYLOAD)', async () => {
    await expect(
      approvals.createApproval(gerantUserId, mandateId, {
        actionType: 'RENT_REDUCTION',
        payload: { leaseId: activeLeaseId },
      }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_APPROVAL_PAYLOAD' } });
  });

  it('only the mandate gérant or assigned agent can request approvals (403)', async () => {
    await expect(
      approvals.createApproval(ownerUserId, mandateId, {
        actionType: 'SALE_PRICE',
        payload: { price: 2_000_000 },
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_MANDATE_ACTOR' } });
  });

  // ---------------------------------------------------------------------
  // TTL + annulation
  // ---------------------------------------------------------------------

  it('an overdue approval turns EXPIRED on read and cannot be decided', async () => {
    const approval = await approvals.createApproval(gerantUserId, mandateId, {
      actionType: 'SALE_PRICE',
      sourceType: 'PROPERTY',
      sourceId: propertyId,
      payload: { price: 2_500_000 },
    });
    createdApprovalIds.push(approval.id);
    await prisma.mandateApproval.update({
      where: { id: approval.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const pending = await approvals.listPendingForOwner(ownerUserId);
    expect(pending.find((a) => a.id === approval.id)).toBeUndefined();

    const row = await prisma.mandateApproval.findUniqueOrThrow({
      where: { id: approval.id },
    });
    expect(row.status).toBe('EXPIRED');

    await expect(
      approvals.decideApproval(ownerUserId, approval.id, {
        decision: 'APPROVE',
      }),
    ).rejects.toMatchObject({ response: { code: 'APPROVAL_EXPIRED' } });

    // Source untouched: property price unchanged.
    const prop = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
    });
    expect(prop.price.toString()).toBe('150000');
  });

  it('the requester cancels a PENDING approval; others cannot', async () => {
    const approval = await approvals.createApproval(gerantUserId, mandateId, {
      actionType: 'MAJOR_REPAIR',
      payload: { ticketId: 'ticket-x' },
      sourceType: 'MAINTENANCE_TICKET',
      sourceId: 'ticket-x',
    });
    createdApprovalIds.push(approval.id);

    await expect(
      approvals.cancelApproval(ownerUserId, approval.id),
    ).rejects.toMatchObject({ response: { code: 'NOT_REQUESTER' } });

    const cancelled = await approvals.cancelApproval(
      gerantUserId,
      approval.id,
    );
    expect(cancelled.status).toBe('CANCELLED');
    await expect(
      approvals.decideApproval(ownerUserId, approval.id, {
        decision: 'APPROVE',
      }),
    ).rejects.toMatchObject({ response: { code: 'APPROVAL_ALREADY_DECIDED' } });
  });

  // ---------------------------------------------------------------------
  // Contre-proposition versionnée + signature OTP (P2)
  // ---------------------------------------------------------------------

  it('counter creates a new version (COUNTERED), the other side accepts', async () => {
    // Second property: the uniqueness rule allows only one living mandate
    // per property+scope, and the first mandate is still ACTIVE here.
    const second = await prisma.property.create({
      data: {
        title: 'Lifecycle Second Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 90000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrgId,
      },
    });
    secondPropertyId = second.id;

    const proposal = await mandates.createMandate(ownerUserId, {
      propertyId: secondPropertyId,
      organizationId: agencyOrgId,
      scopes: ['LONG_TERM_RENTAL'],
      managementFeeRate: 0.1,
    });

    const countered = await mandates.counterMandate(
      gerantUserId,
      proposal.id,
      { managementFeeRate: 0.06, noticeDays: 45, reason: 'Trop élevé' },
    );
    expect(countered.status).toBe('COUNTERED');

    const versions = await prisma.mandateVersion.findMany({
      where: { mandateId: proposal.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(versions.length).toBe(2);
    const terms = versions[1].terms as { managementFeeRate?: number };
    expect(terms.managementFeeRate).toBe(0.06);
    expect(versions[1].proposedBy).toBe(gerantUserId);

    // Owner accepts the agency's counter → ACTIVE.
    const accepted = await mandates.acceptMandate(ownerUserId, proposal.id);
    expect(accepted.status).toBe('ACTIVE');
    expect(accepted.managementFeeRate).toBe('0.06');
    expect(accepted.noticeDays).toBe(45);
  });

  it('signature OTP: both parties sign and the signed PDF is stored', async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: ownerUserId },
    });
    const gerant = await prisma.user.findUniqueOrThrow({
      where: { id: gerantUserId },
    });

    // No code → dispatch an SMS challenge.
    const sent = await mandates.signMandate(ownerUserId, mandateId, {});
    expect(sent.signature?.sent).toBe(true);

    const ownerCode = await otpStore.getWithAttempts(owner.phone as string);
    expect(ownerCode?.purpose).toBe('MANDATE_SIGN');
    expect(ownerCode).not.toBeNull();
    if (!ownerCode) throw new Error('otp missing');

    // Wrong code refused.
    await expect(
      mandates.signMandate(ownerUserId, mandateId, { code: '999999' }),
    ).rejects.toMatchObject({ response: { code: 'SIGN_INVALID_CODE' } });

    const ownerSigned = await mandates.signMandate(ownerUserId, mandateId, {
      code: ownerCode.code,
    });
    expect(ownerSigned.ownerSignedAt).not.toBeNull();
    expect(ownerSigned.agencySignedAt).toBeNull();
    expect(ownerSigned.signature?.bothSigned).toBe(false);

    // Agency side.
    await mandates.signMandate(gerantUserId, mandateId, {});
    const gerantCode = await otpStore.getWithAttempts(gerant.phone as string);
    if (!gerantCode) throw new Error('otp missing');
    const both = await mandates.signMandate(gerantUserId, mandateId, {
      code: gerantCode.code,
    });
    expect(both.agencySignedAt).not.toBeNull();
    expect(both.signature?.bothSigned).toBe(true);
    expect(both.signedDocumentKey).toContain('private/mandat-');

    // A party that already signed cannot sign again.
    await expect(
      mandates.signMandate(ownerUserId, mandateId, {}),
    ).rejects.toMatchObject({ response: { code: 'ALREADY_SIGNED' } });
  });

  // ---------------------------------------------------------------------
  // Résiliation (P0)
  // ---------------------------------------------------------------------

  it('terminate with notice → TERMINATING, agency keeps access until the effective date', async () => {
    const updated = await mandates.terminateMandate(ownerUserId, mandateId, {
      reason: 'Vente du bien',
    });
    expect(updated.status).toBe('TERMINATING');
    expect(updated.terminationReason).toBe('Vente du bien');
    expect(updated.terminationEffectiveAt).not.toBeNull();
    const effective = new Date(updated.terminationEffectiveAt as string);
    const deltaDays = (effective.getTime() - Date.now()) / 86_400_000;
    expect(deltaDays).toBeGreaterThan(29);
    expect(deltaDays).toBeLessThan(31);

    // Access is preserved during the notice period.
    expect(await access.canOperateOnProperty(gerantUserId, propertyId)).toBe(
      true,
    );
    expect(
      await access.canOperateOnProperty(gerantUserId, propertyId),
    ).toBeTruthy();
  });

  it('terminating twice is refused (400 MANDATE_NOT_ACTIVE)', async () => {
    await expect(
      mandates.terminateMandate(ownerUserId, mandateId, {
        reason: 'Encore',
      }),
    ).rejects.toMatchObject({ response: { code: 'MANDATE_NOT_ACTIVE' } });
  });

  it('a non-party cannot terminate (403 NOT_MANDATE_PARTY)', async () => {
    // Reactivate to exercise the authorization check on ACTIVE mandates.
    await prisma.mandate.update({
      where: { id: mandateId },
      data: { status: 'ACTIVE' },
    });
    await expect(
      mandates.terminateMandate(tenantUserId, mandateId, {
        reason: 'Hors-scope',
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_MANDATE_PARTY' } });
  });

  it('immediate termination (faute) ends access right away', async () => {
    const updated = await mandates.terminateMandate(gerantUserId, mandateId, {
      reason: 'Faute grave',
      immediate: true,
    });
    expect(updated.status).toBe('TERMINATED');
    expect(updated.terminationEffectiveAt).toBeTruthy();

    expect(await access.canOperateOnProperty(gerantUserId, propertyId)).toBe(
      false,
    );
    // The owner always keeps access to their own property.
    expect(await access.canOperateOnProperty(ownerUserId, propertyId)).toBe(
      true,
    );
    expect(
      emittedEvents.find((e) => e.name === 'mandate.terminated'),
    ).toBeDefined();
  });

  it('the property is free again: a new mandate can be proposed', async () => {
    const second = await mandates.createMandate(ownerUserId, {
      propertyId,
      organizationId: agencyOrgId,
      scopes: ['LONG_TERM_RENTAL'],
    });
    expect(second.status).toBe('PROPOSED');
    await mandates.declineMandate(gerantUserId, second.id, 'Trop loin');
    const declined = await prisma.mandate.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(declined.status).toBe('DECLINED');
    await prisma.mandate.deleteMany({ where: { id: second.id } });
  });
});
