import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MessageChannel,
  MessageChargeStatus,
  MessagePayerType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingBillingService } from './messaging-billing.service';
import { MessagingController } from './messaging.controller';
import { toXaf } from './messaging.config';

describe('MessagingController — org balance', () => {
  let controller: MessagingController;
  let prisma: PrismaService;
  let countryId: string;
  let orgId: string;
  let memberUserId: string;
  let outsiderUserId: string;
  const fx = 600;

  beforeAll(async () => {
    process.env.USD_TO_XAF = String(fx);
    process.env.SMS_ALERT_UNIT_USD = '0.234';

    const moduleRef = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [MessagingBillingService, PrismaService],
    }).compile();

    controller = moduleRef.get(MessagingController);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const member = await prisma.user.create({
      data: {
        phone: '+242061500001',
        countryId,
      },
    });
    memberUserId = member.id;

    const outsider = await prisma.user.create({
      data: {
        phone: '+242061500002',
        countryId,
      },
    });
    outsiderUserId = outsider.id;

    const org = await prisma.organization.create({
      data: {
        name: `Messaging Balance Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: memberUserId, role: 'AGENT' } },
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.messageCharge
      .deleteMany({
        where: {
          OR: [
            { organizationId: orgId },
            { payerId: orgId },
            { userId: { in: [memberUserId, outsiderUserId] } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => undefined);
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.messageCharge.deleteMany({
      where: { OR: [{ organizationId: orgId }, { payerId: orgId }] },
    });
  });

  it('returns open SMS balance for org members', async () => {
    await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.SMS_ALERT,
        payerType: MessagePayerType.ORGANIZATION,
        payerId: orgId,
        organizationId: orgId,
        userId: memberUserId,
        recipientPhone: '+242061500001',
        billingMonth: '2099-01',
        unitUsd: 0.234,
        fxRate: fx,
        amountXaf: toXaf(0.234, fx),
        status: MessageChargeStatus.OPEN,
        idempotencyKey: `org-balance-test:${orgId}:1`,
      },
    });

    const result = await controller.orgBalance(
      { userId: memberUserId, roles: ['TENANT'] },
      orgId,
    );

    expect(result.organizationId).toBe(orgId);
    expect(result.openBalanceXaf).toBe(toXaf(0.234, fx));
    expect(result.charges).toHaveLength(1);
    expect(result.charges[0].channel).toBe(MessageChannel.SMS_ALERT);
    expect(result.charges[0].status).toBe(MessageChargeStatus.OPEN);
  });

  it('forbids non-members', async () => {
    await expect(
      controller.orgBalance(
        { userId: outsiderUserId, roles: ['TENANT'] },
        orgId,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404 for unknown organization', async () => {
    await expect(
      controller.orgBalance(
        { userId: memberUserId, roles: ['TENANT'] },
        'org_does_not_exist',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
