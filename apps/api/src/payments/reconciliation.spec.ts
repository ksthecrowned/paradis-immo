import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { ReconciliationService } from './reconciliation.service';

/**
 * Spec 05 P2 — rapprochement : import CSV du relevé fournisseur, mise en
 * regard par `providerRef`, écarts `MISSING_IN_DB` / `MISSING_AT_PROVIDER` /
 * `AMOUNT_MISMATCH` (spec 05 US « rapprochement »).
 */
describe('ReconciliationService — spec 05 P2 (rapprochement)', () => {
  let reconciliation: ReconciliationService;
  let prisma: PrismaService;
  let uploadMock: jest.Mock;
  let countryId: string;
  let userId: string;
  let pMatchId: string;
  let pDbOnlyId: string;
  let pMismatchId: string;
  let pOldId: string;
  const stamp = Date.now();

  const refs = {
    match: `PRM-${stamp}`,
    dbOnly: `PRD-${stamp}`,
    mismatch: `PRX-${stamp}`,
    old: `PRO-${stamp}`,
    ghost: `PRG-${stamp}`,
  };

  beforeAll(async () => {
    uploadMock = jest.fn(async (params: { folder: string }) => ({
      url: `https://fake.r2/${params.folder}`,
      key: `${params.folder}/${stamp}.csv`,
    }));
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        PrismaService,
        { provide: R2Service, useValue: { uploadPrivateFile: uploadMock } },
      ],
    }).compile();

    reconciliation = moduleRef.get(ReconciliationService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const stale = await prisma.user.findMany({
      where: { phone: '+242070000199' },
      select: { id: true },
    });
    for (const u of stale) {
      await prisma.payment.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
    }

    const user = await prisma.user.create({
      data: {
        phone: '+242070000199',
        countryId,
        name: 'Spec054 Admin',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    userId = user.id;

    const mkPayment = (providerRef: string, amount: number, createdAt: Date) =>
      prisma.payment.create({
        data: {
          userId,
          amount,
          currency: 'XAF',
          method: 'MOBILE_MONEY',
          provider: 'AIRTEL',
          status: 'VALIDATED',
          reference: `spec054-${providerRef}`,
          idempotencyKey: `spec054-${providerRef}`,
          providerRef,
          createdAt,
        },
      });

    const now = new Date();
    pMatchId = (await mkPayment(refs.match, 100000, now)).id;
    pDbOnlyId = (await mkPayment(refs.dbOnly, 200000, now)).id;
    pMismatchId = (await mkPayment(refs.mismatch, 300000, now)).id;
    pOldId = (
      await mkPayment(refs.old, 400000, new Date(now.getTime() - 5 * 86_400_000))
    ).id;
  });

  afterAll(async () => {
    const runIds = (
      await prisma.reconciliationRun.findMany({
        where: { createdById: userId },
        select: { id: true },
      })
    ).map((r) => r.id);
    if (runIds.length) {
      await prisma.reconciliationLine
        .deleteMany({ where: { runId: { in: runIds } } })
        .catch(() => undefined);
      await prisma.reconciliationRun
        .deleteMany({ where: { id: { in: runIds } } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.payment.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.userRole.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.onModuleDestroy();
  });

  it('refuse un CSV vide ou mal formé', async () => {
    await expect(
      reconciliation.importRun(
        {
          provider: 'AIRTEL',
          csv: 'providerRef,amount,date\n',
          periodStart: new Date(Date.now() - 3600_000),
          periodEnd: new Date(),
        },
        userId,
      ),
    ).rejects.toMatchObject({ response: { code: 'EMPTY_CSV' } });

    await expect(
      reconciliation.importRun(
        {
          provider: 'AIRTEL',
          csv: 'pas-de-reference,quantite',
          periodStart: new Date(Date.now() - 3600_000),
          periodEnd: new Date(),
        },
        userId,
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_CSV' } });
  });

  it('importe un relevé et classe les écarts', async () => {
    const periodStart = new Date(Date.now() - 3600_000);
    const periodEnd = new Date();
    const csv = [
      'providerRef,amount,date',
      `${refs.match},100000,2026-10-01`,
      `${refs.mismatch},350000,2026-10-02`,
      `${refs.ghost},99900,2026-10-03`,
    ].join('\n');

    const run = await reconciliation.importRun(
      { provider: 'AIRTEL', csv, periodStart, periodEnd },
      userId,
    );

    expect(run.summary).toMatchObject({
      provider: 'AIRTEL',
      rows: 3,
      matched: 1,
      missingInDb: 1,
      missingAtProvider: 1,
      amountMismatch: 1,
    });
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(run.lines).toHaveLength(3);

    const byKind = Object.fromEntries(run.lines.map((l) => [l.kind, l]));
    expect(byKind.MISSING_IN_DB).toMatchObject({
      providerRef: refs.ghost,
      amountProvider: '99900',
      amountDb: null,
    });
    expect(byKind.AMOUNT_MISMATCH).toMatchObject({
      providerRef: refs.mismatch,
      paymentId: pMismatchId,
      amountProvider: '350000',
      amountDb: '300000',
    });
    // pDbOnly est en période mais absent du relevé.
    expect(byKind.MISSING_AT_PROVIDER).toMatchObject({
      providerRef: refs.dbOnly,
      paymentId: pDbOnlyId,
      amountProvider: null,
      amountDb: '200000',
    });
    // pMatch est apparié ; pOld est hors période → aucun écart.
    const ids = run.lines.map((l) => l.paymentId);
    expect(ids).not.toContain(pMatchId);
    expect(ids).not.toContain(pOldId);

    // Le run est persisté et relisible (écarts pour l'admin).
    const fetched = await reconciliation.getRun(run.id);
    expect(fetched.id).toBe(run.id);
    expect(fetched.lines).toHaveLength(3);
    expect(fetched.lines.every((l) => l.resolved === false)).toBe(true);
  });

  it('404 sur un run inexistant et période invalide', async () => {
    await expect(reconciliation.getRun('nope')).rejects.toMatchObject({
      status: 404,
      response: { code: 'RECONCILIATION_RUN_NOT_FOUND' },
    });

    await expect(
      reconciliation.importRun(
        {
          provider: 'MOMO',
          csv: `${refs.match},100000,2026-10-01`,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() - 3600_000),
        },
        userId,
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_PERIOD' } });
  });
});
