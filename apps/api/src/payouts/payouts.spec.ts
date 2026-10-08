import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { PayoutsService } from './payouts.service';

/**
 * Spec 05 P1 — reversements : solde du ledger hors montants en litige,
 * comptes de reversement (création, vérification sandbox, défaut),
 * reversement à la demande (seuil `minPayoutAmount`, garde-fou double
 * demande), échec sandbox + relance admin, cron mensuel du 10.
 */
describe('PayoutsService — spec 05 P1 (reversements)', () => {
  let payouts: PayoutsService;
  let prisma: PrismaService;
  let events: { emit: jest.Mock };
  let countryId: string;
  let quartierId: string;

  let owner1Id: string;
  let owner2Id: string;
  let owner3Id: string;
  let owner4Id: string;
  let strangerId: string;
  let payerId: string;

  let org1Id: string;
  let org2Id: string;
  let org3Id: string;
  let org4Id: string;
  let prop1Id: string;
  let prop2Id: string;
  let prop3Id: string;
  let prop4Id: string;
  let dispPaymentId: string;
  let accountAId: string;
  let accountBId: string;

  const phones = {
    owner1: '+242070000181',
    owner2: '+242070000182',
    owner3: '+242070000183',
    owner4: '+242070000184',
    stranger: '+242070000185',
    payer: '+242070000186',
  };
  const stamp = Date.now();

  beforeAll(async () => {
    events = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutsService,
        PrismaService,
        { provide: EventPublisher, useValue: events },
      ],
    }).compile();

    payouts = moduleRef.get(PayoutsService);
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

    // Purge leftovers of a previous crashed run (unique phone).
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
      await prisma.payment.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    owner1Id = (await mk(phones.owner1, 'Spec052 Owner1')).id;
    owner2Id = (await mk(phones.owner2, 'Spec052 Owner2')).id;
    owner3Id = (await mk(phones.owner3, 'Spec052 Owner3')).id;
    owner4Id = (await mk(phones.owner4, 'Spec052 Owner4')).id;
    strangerId = (await mk(phones.stranger, 'Spec052 Stranger')).id;
    payerId = (await mk(phones.payer, 'Spec052 Payer')).id;

    const mkOrg = (
      name: string,
      ownerId: string,
      payoutFrequency: 'MONTHLY' | 'ON_DEMAND',
    ) =>
      prisma.organization.create({
        data: {
          name: `${name} ${stamp}`,
          type: 'OWNER',
          countryId,
          payoutFrequency,
          requireDualCashValidation: false,
          members: { create: { userId: ownerId, role: 'OWNER' } },
        },
      });
    org1Id = (await mkOrg('Spec052 Org1', owner1Id, 'MONTHLY')).id;
    org2Id = (await mkOrg('Spec052 Org2', owner2Id, 'MONTHLY')).id;
    org3Id = (await mkOrg('Spec052 Org3', owner3Id, 'ON_DEMAND')).id;
    org4Id = (await mkOrg('Spec052 Org4', owner4Id, 'MONTHLY')).id;

    const mkProp = (title: string, ownerId: string, orgId: string) =>
      prisma.property.create({
        data: {
          title,
          description: 'Spec 05 reversements',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId,
          address: 'Spec052',
          countryId,
          ownerId,
          organizationId: orgId,
        },
      });
    prop1Id = (await mkProp('Spec052 Prop1', owner1Id, org1Id)).id;
    prop2Id = (await mkProp('Spec052 Prop2', owner2Id, org2Id)).id;
    prop3Id = (await mkProp('Spec052 Prop3', owner3Id, org3Id)).id;
    prop4Id = (await mkProp('Spec052 Prop4', owner4Id, org4Id)).id;

    const entry = (
      propertyId: string,
      orgId: string,
      type: string,
      amount: number,
      sourceType: string,
      sourceId: string,
    ) =>
      prisma.ledgerEntry.create({
        data: {
          propertyId,
          ownerOrgId: orgId,
          type: type as never,
          amount,
          currency: 'XAF',
          sourceType,
          sourceId,
          label: `Spec052 ${type}`,
          occurredAt: new Date(),
        },
      });

    // Org1: net = 500 000 − 100 000 = 400 000 hors litige (le paiement en
    // litige de 150 000 est crédité au ledger mais exclu du solde).
    await entry(prop1Id, org1Id, 'RENT_IN', 500000, 'MANUAL', `m1-${stamp}`);
    await entry(prop1Id, org1Id, 'EXPENSE', -100000, 'MANUAL', `m2-${stamp}`);
    const disputed = await prisma.payment.create({
      data: {
        userId: payerId,
        amount: 150000,
        currency: 'XAF',
        method: 'CASH',
        status: 'VALIDATED',
        reference: `spec052-disp-${stamp}`,
        idempotencyKey: `spec052-disp-${stamp}`,
      },
    });
    dispPaymentId = disputed.id;
    await prisma.paymentDispute.create({
      data: {
        paymentId: dispPaymentId,
        openedById: payerId,
        reason: 'OTHER',
        description: 'Spec052 litige ouvert',
        status: 'OPEN',
      },
    });
    await entry(
      prop1Id,
      org1Id,
      'RENT_IN',
      150000,
      'PAYMENT',
      dispPaymentId,
    );

    // Org2: solde 200 000 + compte vérifié → cron verse.
    await entry(prop2Id, org2Id, 'RENT_IN', 200000, 'MANUAL', `m3-${stamp}`);
    await prisma.payoutAccount.create({
      data: {
        organizationId: org2Id,
        type: 'MOBILE_MONEY',
        provider: 'AIRTEL',
        phone: '+242070000101',
        holderName: 'Spec052 Owner2',
        verifiedAt: new Date(),
        isDefault: true,
      },
    });

    // Org3: solde mais fréquence ON_DEMAND → cron ignore.
    await entry(prop3Id, org3Id, 'RENT_IN', 200000, 'MANUAL', `m4-${stamp}`);
    await prisma.payoutAccount.create({
      data: {
        organizationId: org3Id,
        type: 'MOBILE_MONEY',
        provider: 'MOMO',
        phone: '+242070000102',
        holderName: 'Spec052 Owner3',
        verifiedAt: new Date(),
        isDefault: true,
      },
    });

    // Org4: MONTHLY mais aucun compte vérifié → cron ignore.
    await entry(prop4Id, org4Id, 'RENT_IN', 200000, 'MANUAL', `m5-${stamp}`);
  });

  afterAll(async () => {
    const orgIds = [org1Id, org2Id, org3Id, org4Id].filter(Boolean);
    const userIds = [
      owner1Id,
      owner2Id,
      owner3Id,
      owner4Id,
      strangerId,
      payerId,
    ].filter(Boolean);
    const propIds = [prop1Id, prop2Id, prop3Id, prop4Id].filter(Boolean);

    await prisma.payout
      .deleteMany({ where: { organizationId: { in: orgIds } } })
      .catch(() => undefined);
    await prisma.payoutAccount
      .deleteMany({ where: { organizationId: { in: orgIds } } })
      .catch(() => undefined);
    await prisma.ledgerEntry
      .deleteMany({ where: { propertyId: { in: propIds } } })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { id: dispPaymentId } })
      .catch(() => undefined);
    await prisma.notification
      .deleteMany({ where: { userId: { in: userIds } } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: propIds } } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { userId: { in: userIds } } })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { id: { in: orgIds } } })
      .catch(() => undefined);
    await prisma.userRole
      .deleteMany({ where: { userId: { in: userIds } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: userIds } } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  describe('solde disponible', () => {
    it('exclut les montants en litige du solde du ledger', async () => {
      const { balance, currency, disputedAmount } =
        await payouts.availableBalance([org1Id]);
      expect(currency).toBe('XAF');
      expect(disputedAmount.toString()).toBe('150000');
      // 500 000 − 100 000 ; les 150 000 litigieux sont exclus.
      expect(balance.toString()).toBe('400000');
    });

    it('refuse les comptes de reversement à un étranger', async () => {
      await expect(
        payouts.listAccounts(strangerId, org1Id),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYOUT_ACCOUNT_FORBIDDEN' },
      });
    });
  });

  describe('comptes de reversement', () => {
    it('crée, vérifie (sandbox) et rend par défaut', async () => {
      const created = await payouts.createAccount(owner1Id, org1Id, {
        type: 'MOBILE_MONEY',
        provider: 'AIRTEL',
        phone: '+242070000171',
        holderName: 'Spec052 Owner1',
      });
      accountAId = created.id;
      expect(created.verifiedAt).toBeNull();

      await expect(
        payouts.verifyAccount(owner1Id, org1Id, accountAId, '999'),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_VERIFICATION_CODE' },
      });

      const verified = await payouts.verifyAccount(
        owner1Id,
        org1Id,
        accountAId,
        '1',
      );
      expect(verified.verifiedAt).not.toBeNull();

      const updated = await payouts.updateAccount(owner1Id, org1Id, accountAId, {
        isDefault: true,
      });
      expect(updated.isDefault).toBe(true);
    });
  });

  describe('reversement à la demande', () => {
    it('refuse sans compte vérifié', async () => {
      // Org4 n'a pas de compte : la demande échoue (les comptes créés plus
      // bas sont rattachés à org1).
      await expect(
        payouts.requestPayout(owner4Id, {}),
      ).rejects.toMatchObject({
        response: { code: 'NO_VERIFIED_PAYOUT_ACCOUNT' },
      });
    });

    it('refuse sous le montant minimum', async () => {
      const settings = await payouts.updateSettings(owner1Id, org1Id, {
        minPayoutAmount: 1000000,
      });
      expect(settings.minPayoutAmount).toBe('1000000');

      await expect(payouts.requestPayout(owner1Id, {})).rejects.toMatchObject({
        response: {
          code: 'MINIMUM_PAYOUT_NOT_REACHED',
          balance: '400000',
          minPayoutAmount: '1000000',
        },
      });

      await payouts.updateSettings(owner1Id, org1Id, { minPayoutAmount: 10000 });
    });

    it('reversement aboutit (PAID, événement PAYOUT_PAID)', async () => {
      events.emit.mockClear();
      const result = await payouts.requestPayout(owner1Id, {});
      expect(result.status).toBe('PAID');
      expect(result.amount).toBe('400000');
      expect(result.kind).toBe('OWNER_NET');
      expect(result.providerRef).toMatch(/^po_/);
      expect(result.paidAt).not.toBeNull();
      expect(result.account?.masked).toBe('+24207***71');

      expect(events.emit).toHaveBeenCalledWith(
        'payout.paid',
        expect.objectContaining({
          payoutId: result.id,
          organizationId: org1Id,
          amount: '400000',
          currency: 'XAF',
        }),
      );
    });

    it('exclut les reversements déjà engagés du solde', async () => {
      const { balance } = await payouts.availableBalance([org1Id]);
      expect(balance.toString()).toBe('0');

      await expect(payouts.requestPayout(owner1Id, {})).rejects.toMatchObject({
        response: {
          code: 'MINIMUM_PAYOUT_NOT_REACHED',
          balance: '0',
        },
      });
    });

    it('refuse une seconde demande tant qu’une est en cours', async () => {
      const open = await prisma.payout.create({
        data: {
          organizationId: org1Id,
          payoutAccountId: accountAId,
          amount: 1000,
          currency: 'XAF',
          kind: 'OWNER_NET',
          status: 'PENDING',
        },
      });
      await expect(payouts.requestPayout(owner1Id, {})).rejects.toMatchObject({
        status: 409,
        response: { code: 'PAYOUT_IN_PROGRESS' },
      });
      await prisma.payout.delete({ where: { id: open.id } });
    });

    it('échec sandbox, file admin et relance manuelle', async () => {
      events.emit.mockClear();
      // Nouveau solde : +500 000 (déjà engagé : 400 000).
      await prisma.ledgerEntry.create({
        data: {
          propertyId: prop1Id,
          ownerOrgId: org1Id,
          type: 'RENT_IN',
          amount: 500000,
          currency: 'XAF',
          sourceType: 'MANUAL',
          sourceId: `m6-${stamp}`,
          label: 'Spec052 RENT_IN',
          occurredAt: new Date(),
        },
      });

      const trap = await payouts.createAccount(owner1Id, org1Id, {
        type: 'MOBILE_MONEY',
        provider: 'MOMO',
        phone: '+2420700009999',
        holderName: 'Spec052 Owner1',
      });
      accountBId = trap.id;
      await payouts.verifyAccount(owner1Id, org1Id, accountBId, '1');

      const failed = await payouts.requestPayout(owner1Id, {
        payoutAccountId: accountBId,
      });
      expect(failed.status).toBe('FAILED');
      expect(failed.failureReason).toBe('SANDBOX_TRANSFER_FAILED');
      expect(events.emit).toHaveBeenCalledWith(
        'payout.failed',
        expect.objectContaining({
          payoutId: failed.id,
          reason: 'SANDBOX_TRANSFER_FAILED',
        }),
      );

      const queue = await payouts.listAdmin({ status: 'FAILED' });
      expect(queue.data.some((p) => p.id === failed.id)).toBe(true);
      expect(queue.meta.total).toBeGreaterThanOrEqual(1);

      // Un paiement échoué n'est pas retenté automatiquement : l'admin
      // relance après correction du numéro.
      await prisma.payoutAccount.update({
        where: { id: accountBId },
        data: { phone: '+242070000172' },
      });
      const retried = await payouts.retry(failed.id);
      expect(retried.status).toBe('PAID');
      expect(retried.providerRef).toMatch(/^po_/);

      await expect(payouts.retry(failed.id)).rejects.toMatchObject({
        response: { code: 'PAYOUT_NOT_RETRYABLE' },
      });
    });

    it('listMine renvoie les reversements du propriétaire (paginé)', async () => {
      const mine = await payouts.listMine(owner1Id, {});
      expect(mine.meta.total).toBeGreaterThanOrEqual(2);
      expect(mine.data.every((p) => p.organizationId === org1Id)).toBe(true);
      expect(mine.data[0].account?.holderName).toBe('Spec052 Owner1');

      const empty = await payouts.listMine(strangerId, {});
      expect(empty.data).toEqual([]);
      expect(empty.meta.total).toBe(0);
    });
  });

  describe('cron mensuel (le 10)', () => {
    it('verse les orgs MONTHLY avec solde et compte vérifié', async () => {
      const before = await prisma.payout.count({
        where: { organizationId: org3Id },
      });
      expect(before).toBe(0);

      await payouts.runMonthlyPayouts();

      const org2Payouts = await prisma.payout.findMany({
        where: { organizationId: org2Id },
      });
      expect(org2Payouts).toHaveLength(1);
      expect(org2Payouts[0].status).toBe('PAID');
      expect(org2Payouts[0].amount.toString()).toBe('200000');
      expect(org2Payouts[0].kind).toBe('OWNER_NET');

      // ON_DEMAND → pas de versement automatique.
      expect(
        await prisma.payout.count({ where: { organizationId: org3Id } }),
      ).toBe(0);
      // MONTHLY sans compte vérifié → rien.
      expect(
        await prisma.payout.count({ where: { organizationId: org4Id } }),
      ).toBe(0);

      // Re-run idempotent : solde déjà versé → pas de doublon.
      await payouts.runMonthlyPayouts();
      expect(
        await prisma.payout.count({ where: { organizationId: org2Id } }),
      ).toBe(1);
    });
  });

  describe('paramètres de reversement', () => {
    it('met à jour fréquence et montant minimum (propriétaire uniquement)', async () => {
      const settings = await payouts.updateSettings(owner1Id, org1Id, {
        payoutFrequency: 'ON_DEMAND',
        minPayoutAmount: 5000,
      });
      expect(settings).toEqual({
        payoutFrequency: 'ON_DEMAND',
        minPayoutAmount: '5000',
      });

      await expect(
        payouts.updateSettings(strangerId, org1Id, { minPayoutAmount: 1 }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYOUT_ACCOUNT_FORBIDDEN' },
      });
    });

    it('retourne les paramètres actuels (gestion autorisée uniquement)', async () => {
      const ok = await payouts.getSettings(owner1Id, org1Id);
      expect(ok).toEqual({
        payoutFrequency: 'MONTHLY',
        minPayoutAmount: '10000',
      });

      await expect(payouts.getSettings(owner4Id, org1Id)).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYOUT_ACCOUNT_FORBIDDEN' },
      });
    });
  });

  describe('paramètres de reversement', () => {
    it('met à jour fréquence et montant minimum (propriétaire uniquement)', async () => {
      const settings = await payouts.updateSettings(owner1Id, org1Id, {
        payoutFrequency: 'ON_DEMAND',
        minPayoutAmount: 5000,
      });
      expect(settings).toEqual({
        payoutFrequency: 'ON_DEMAND',
        minPayoutAmount: '5000',
      });

      await expect(
        payouts.updateSettings(strangerId, org1Id, { minPayoutAmount: 1 }),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'PAYOUT_ACCOUNT_FORBIDDEN' },
      });
    });
  });
});
