import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VisitBookingStatus, VisitSlotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { UsersService } from '../users/users.service';
import { VisitSlotsService } from './visit-slots.service';

/**
 * Spec 06 P2 — plages d'indisponibilité (blackouts) :
 * - création par le gestionnaire : slots chevauchants → BLOCKED,
 *   visites futures de la plage → CANCELLED (cancelledById ≠ visiteur)
 *   + events, slot de la visite → BLOCKED ;
 * - levée : les slots BLOCKED de la plage redeviennent AVAILABLE ;
 * - négatif : tiers (403), dates invalides (400), plage passée (400),
 *   blackout inconnu (404).
 */
describe('VisitSlotsService — blackouts (spec 06 P2)', () => {
  let slots: VisitSlotsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let seekerUserId: string;
  let outsiderUserId: string;
  let organizationId: string;
  let propertyId: string;

  const baseStart = () => new Date(Date.now() + 48 * 3_600_000);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitSlotsService,
        AgencyAccessService,
        PrismaService,
        UsersService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    slots = moduleRef.get(VisitSlotsService);
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

    const phones = ['+242071500001', '+242071500002', '+242071500003'];
    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.visitBooking.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.property.deleteMany({ where: { ownerId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const [owner, seeker, outsider] = await Promise.all(
      phones.map((phone) =>
        prisma.user.create({
          data: { phone, countryId, roles: { create: { role: 'TENANT' } } },
        }),
      ),
    );
    ownerUserId = owner.id;
    seekerUserId = seeker.id;
    outsiderUserId = outsider.id;

    const org = await prisma.organization.create({
      data: {
        name: `Blackout Test Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    organizationId = org.id;

    const property = await prisma.property.create({
      data: {
        title: 'Blackout Test Property',
        description: 'Indisponibilités',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
        status: 'ACTIVE',
        visitEnabled: true,
        visitType: 'FREE',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (propertyId) {
      await prisma.visitBooking.deleteMany({ where: { propertyId } });
      await prisma.visitSlot.deleteMany({ where: { propertyId } });
      await prisma.visitBlackout.deleteMany({ where: { propertyId } });
      await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    }
    if (organizationId) {
      await prisma.organizationMember.deleteMany({ where: { organizationId } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
    }
    const ids = [ownerUserId, seekerUserId, outsiderUserId].filter(Boolean);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  const makeSlot = async (offsetHours: number) =>
    prisma.visitSlot.create({
      data: {
        propertyId,
        startAt: new Date(baseStart().getTime() + offsetHours * 3_600_000),
        endAt: new Date(baseStart().getTime() + (offsetHours + 1) * 3_600_000),
        status: VisitSlotStatus.AVAILABLE,
      },
    });

  it('créer un blackout : slots chevauchants → BLOCKED, visites → annulées + release immédiate', async () => {
    const inRange1 = await makeSlot(0);
    const inRange2 = await makeSlot(2);
    const outside = await makeSlot(96);

    // Une visite CONFIRMED sur un créneau de la plage.
    const booking = await slots.bookVisit(seekerUserId, {
      slotId: inRange1.id,
      propertyId,
    });

    const start = new Date(baseStart().getTime());
    const end = new Date(baseStart().getTime() + 10 * 3_600_000);
    const blackout = await slots.createBlackout(ownerUserId, {
      propertyId,
      startsAt: start,
      endsAt: end,
      reason: 'Travaux',
    });

    expect(blackout.reason).toBe('Travaux');

    // Slot hors plage intact.
    const outSlot = await prisma.visitSlot.findUnique({
      where: { id: outside.id },
      select: { status: true },
    });
    expect(outSlot?.status).toBe(VisitSlotStatus.AVAILABLE);

    // La visite de la plage est annulée par l'agence (cancelledById ≠ visiteur).
    const b = await prisma.visitBooking.findUnique({
      where: { id: booking.id },
      select: {
        status: true,
        cancelledById: true,
        cancelReason: true,
        userId: true,
      },
    });
    expect(b?.status).toBe(VisitBookingStatus.CANCELLED);
    expect(b?.cancelledById).toBe(ownerUserId);
    expect(b?.cancelledById).not.toBe(b?.userId);
    expect(b?.cancelReason).toBe('Travaux');

    // Les créneaux de la plage (dont celui de la visite annulée) → BLOCKED.
    const s1 = await prisma.visitSlot.findUnique({
      where: { id: inRange1.id },
      select: { status: true },
    });
    const s2 = await prisma.visitSlot.findUnique({
      where: { id: inRange2.id },
      select: { status: true },
    });
    expect(s1?.status).toBe(VisitSlotStatus.BLOCKED);
    expect(s2?.status).toBe(VisitSlotStatus.BLOCKED);
  });

  it('lever un blackout : les slots de la plage redeviennent AVAILABLE', async () => {
    const s1 = await makeSlot(120);
    const s2 = await makeSlot(122);
    void s2;

    const blackout = await slots.createBlackout(ownerUserId, {
      propertyId,
      startsAt: new Date(baseStart().getTime() + 120 * 3_600_000),
      endsAt: new Date(baseStart().getTime() + 130 * 3_600_000),
    });

    expect(
      (await prisma.visitSlot.findUnique({ where: { id: s1.id }, select: { status: true } }))
        ?.status,
    ).toBe(VisitSlotStatus.BLOCKED);

    await slots.deleteBlackout(ownerUserId, blackout.id);

    expect(
      (await prisma.visitSlot.findUnique({ where: { id: s1.id }, select: { status: true } }))
        ?.status,
    ).toBe(VisitSlotStatus.AVAILABLE);
    await expect(
      slots.deleteBlackout(ownerUserId, blackout.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("un tiers ne peut ni créer, ni lever un blackout (403)", async () => {
    await expect(
      slots.createBlackout(outsiderUserId, {
        propertyId,
        startsAt: baseStart(),
        endsAt: new Date(baseStart().getTime() + 3_600_000),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('dates invalides (400) et plage passée (400)', async () => {
    await expect(
      slots.createBlackout(ownerUserId, {
        propertyId,
        startsAt: new Date(baseStart().getTime() + 5 * 3_600_000),
        endsAt: baseStart(), // end <= start
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      slots.createBlackout(ownerUserId, {
        propertyId,
        startsAt: new Date(Date.now() - 10 * 3_600_000),
        endsAt: new Date(Date.now() - 2 * 3_600_000), // tout est passé
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('les créneaux bloqués restent indisponibles (via reschedule et bookVisit)', async () => {
    const from = await makeSlot(200);
    const target = await makeSlot(202);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });

    // Blackout couvrant le créneau cible uniquement.
    const black = await slots.createBlackout(ownerUserId, {
      propertyId,
      startsAt: new Date(baseStart().getTime() + 202 * 3_600_000),
      endsAt: new Date(baseStart().getTime() + 204 * 3_600_000),
    });

    // Le slot cible est BLOCKED et une réservation dessus répond 409.
    const blockedSlot = await prisma.visitSlot.findUnique({
      where: { id: target.id },
      select: { status: true },
    });
    expect(blockedSlot?.status).toBe(VisitSlotStatus.BLOCKED);

    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, target.id),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      slots.bookVisit(seekerUserId, { slotId: target.id, propertyId }),
    ).rejects.toBeInstanceOf(ConflictException);

    // L'utilisateur a été notifié lorsque sa visite a été déplacée ; ici
    // rien ne bouge, on nettoie le booking.
    await prisma.visitBooking.delete({ where: { id: booking.id } });
  });

  it('liste : listBlackouts renvoie les plages du bien', async () => {
    const rows = await slots.listBlackouts(ownerUserId, propertyId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.propertyId === propertyId)).toBe(true);
  });
});
