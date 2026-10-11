import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InspectionType, ItemCondition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import {
  InspectionsService,
  UpdateInspectionPayload,
} from './inspections.service';

/**
 * Spec 15 B1 — états des lieux (spec 04).
 * Fixtures : bail ACTIVE sur un bien de test ; le tenant et le gestionnaire
 * (owner sans mandat) signent ; vérification immutabilité post-signature,
 * réserves, comparatif entrée/sortie.
 */
describe('InspectionsService (spec 15 B1)', () => {
  let inspections: InspectionsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let ownerOrgId: string;
  let leaseId: string;
  let inspectionInId: string;
  let inspectionOutId: string;
  const createdInspectionIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InspectionsService,
        PrismaService,
        AgencyAccessService,
      ],
    }).compile();
    inspections = moduleRef.get(InspectionsService);
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

    // Clean leftovers
    const stale = await prisma.user.findMany({
      where: {
        phone: { in: ['+242079999901', '+242079999902'] },
      },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.inspection
        .deleteMany({ where: { lease: { property: { ownerId: { in: staleIds } } } } })
        .catch(() => undefined);
      const staleLeases = await prisma.lease.findMany({
        where: { property: { ownerId: { in: staleIds } } },
        select: { id: true },
      });
      if (staleLeases.length) {
        await prisma.lease.deleteMany({
          where: { id: { in: staleLeases.map((l) => l.id) } },
        });
      }
      await prisma.property.deleteMany({
        where: { ownerId: { in: staleIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    ownerUserId = (
      await prisma.user.create({
        data: {
          phone: '+242079999901',
          countryId,
          roles: { create: { role: 'TENANT' } },
        },
      })
    ).id;
    tenantUserId = (
      await prisma.user.create({
        data: {
          phone: '+242079999902',
          countryId,
          roles: { create: { role: 'TENANT' } },
        },
      })
    ).id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Inspection Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const lease = await prisma.lease.create({
      data: {
        property: {
          create: {
            title: 'Inspection Test Property',
            description: 'EDL test',
            type: 'APARTMENT',
            mode: 'RENT_LONG',
            price: 150_000,
            currency: 'XAF',
            priceUnit: 'MONTH',
            quartierId: bzvQuartierId,
            address: 'X',
            countryId,
            ownerId: ownerUserId,
            organizationId: ownerOrg.id,
          },
        },
        tenant: { connect: { id: tenantUserId } },
        monthlyRent: 150_000,
        chargesAmount: 0,
        currency: 'XAF',
        startDate: new Date(Date.now() - 30 * 86_400_000),
        endDate: new Date(Date.now() + 300 * 86_400_000),
        status: 'ACTIVE',
        dueDay: 5,
        deposit: 300_000,
      },
    });
    leaseId = lease.id;
  });

  afterAll(async () => {
    if (createdInspectionIds.length) {
      await prisma.inspection
        .deleteMany({ where: { id: { in: createdInspectionIds } } })
        .catch(() => undefined);
    }
    if (leaseId) {
      await prisma.lease
        .delete({ where: { id: leaseId } })
        .catch(() => undefined);
    }
    if (ownerOrgId) {
      await prisma.organizationMember
        .deleteMany({ where: { userId: { in: [ownerUserId, tenantUserId] } } })
        .catch(() => undefined);
      await prisma.organization
        .delete({ where: { id: ownerOrgId } })
        .catch(() => undefined);
    }
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerUserId, tenantUserId] } } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  const draftIn: UpdateInspectionPayload = {
    generalComment: 'Bon état général',
    meters: { water: '12345', electricity: '6789' },
    keys: [{ label: 'Porte principale', count: 2 }],
    rooms: [
      {
        name: 'Salon',
        items: [
          {
            label: 'Peinture murale',
            condition: ItemCondition.GOOD,
            comment: 'Légère trace',
          },
          { label: 'Évier', condition: ItemCondition.NEW },
        ],
      },
    ],
  };

  it("crée un EDL CHECK_IN puis refuse un doublon (409 INSPECTION_ALREADY_EXISTS)", async () => {
    const inspection = await inspections.create(
      ownerUserId,
      leaseId,
      InspectionType.CHECK_IN,
    );
    createdInspectionIds.push(inspection.id);
    inspectionInId = inspection.id;
    expect(inspection.type).toBe(InspectionType.CHECK_IN);
    expect(inspection.managerSignedAt).toBeNull();

    await expect(
      inspections.create(ownerUserId, leaseId, InspectionType.CHECK_IN),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remplit le brouillon (rooms/compteurs) en tant que gestionnaire', async () => {
    const updated = await inspections.update(
      ownerUserId,
      inspectionInId,
      draftIn,
    );
    expect(updated.rooms).toHaveLength(1);
    expect(updated.rooms[0].items).toHaveLength(2);
    void prisma;
  });

  it('le tier non partie ne peut pas lire (403)', async () => {
    // Un user sans lien au bien : accès interdit via assertCanOperate.
    const stranger = await prisma.user.create({
      data: {
        phone: `+24207${Date.now().toString().slice(-8)}`,
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    try {
      await expect(
        inspections.getOne(stranger.id, inspectionInId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await prisma.userRole
        .deleteMany({ where: { userId: stranger.id } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: stranger.id } })
        .catch(() => undefined);
    }
  });

  it('signature gestionnaire → tenant signe → immuable (409 INSPECTION_SIGNED)', async () => {
    const byManager = await inspections.sign(
      ownerUserId,
      inspectionInId,
      false,
    );
    expect(byManager.managerSignedAt).not.toBeNull();
    expect(byManager.reservesUntil).not.toBeNull();

    const byTenant = await inspections.sign(tenantUserId, inspectionInId, true);
    expect(byTenant.tenantSignedAt).not.toBeNull();

    // Un autre signataire n'a rien à changer : re-sign est no-op.
    const reSigned = await inspections.sign(tenantUserId, inspectionInId, true);
    expect(reSigned.tenantSignedAt).toBe(byTenant.tenantSignedAt);

    // Après double signature, update → 409.
    await expect(
      inspections.update(ownerUserId, inspectionInId, {
        generalComment: 'tentative',
      }),
    ).rejects.toMatchObject({ response: { code: 'INSPECTION_SIGNED' } });
  });

  it('réserves du locataire dans la fenêtre', async () => {
    const updated = await inspections.addReserve(
      tenantUserId,
      inspectionInId,
      'Rayure non signalée au fond du salon',
      ['reserve.jpg'],
    );
    expect(updated.reserves).toHaveLength(1);
    expect(updated.reserves[0].text).toContain('Rayure');
  });

  it('crée un CHECK_OUT, compare renvoie les écarts (peinture GOOD→DAMAGED)', async () => {
    const out = await inspections.create(
      ownerUserId,
      leaseId,
      InspectionType.CHECK_OUT,
    );
    createdInspectionIds.push(out.id);
    inspectionOutId = out.id;

    await inspections.update(ownerUserId, inspectionOutId, {
      generalComment: 'État de sortie',
      rooms: [
        {
          name: 'Salon',
          items: [
            {
              label: 'Peinture murale',
              condition: ItemCondition.DAMAGED,
              comment: 'Large trace',
            },
            { label: 'Évier', condition: ItemCondition.GOOD },
          ],
        },
      ],
    });
    await inspections.sign(ownerUserId, inspectionOutId, false);
    await inspections.sign(tenantUserId, inspectionOutId, true);

    const compare = await inspections.compare(ownerUserId, leaseId);
    // Deux écarts : peinture GOOD→DAMAGED, et évier NEW→GOOD (dégradé).
    // Le comparatif liste tout ce qui a été constaté plus dégradé
    // qu'en entrée (selon la ladder NEW < GOOD < WORN < DAMAGED < MISSING).
    expect(compare.total).toBe(2);
    const peinture = compare.tally.find((e) => e.label === 'Peinture murale');
    expect(peinture?.conditionIn).toBe(ItemCondition.GOOD);
    expect(peinture?.conditionOut).toBe(ItemCondition.DAMAGED);
    expect(
      compare.tally.find((e) => e.label === 'Évier'),
    ).toBeDefined();
  });
});
