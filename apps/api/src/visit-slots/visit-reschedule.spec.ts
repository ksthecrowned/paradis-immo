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
 * Spec 06 (delta 06.3/06.5) — reprogrammation d'une visite avec blackout et
 * capacité :
 * - chercheur ou gestionnaire déplace une réservation PENDING/CONFIRMED ;
 * - le créneau cible doit être AVAILABLE (conflit 409 sinon) ;
 * - un blackout (slot BLOCKED) est refusé en cible ;
 * - l'ancien créneau est libéré (AVAILABLE) ;
 * - un tiers ni lit ni reprogramme ; capacity 1 : un second booking sur le
 *   créneau source libéré redevient possible (libération vérifiée).
 */
describe('VisitSlotsService — reschedule (spec 06)', () => {
  let slots: VisitSlotsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let seekerUserId: string;
  let outsiderUserId: string;
  let organizationId: string;
  let propertyId: string;
  const createdBookingIds: string[] = [];

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

    const phones = ['+242071400001', '+242071400002', '+242071400003'];
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
        name: `Reschedule Test Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    organizationId = org.id;

    const property = await prisma.property.create({
      data: {
        title: 'Reschedule Test Property',
        description: 'Visites reprogrammables',
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

  const makeSlot = async (
    offsetHours: number,
    status: VisitSlotStatus = VisitSlotStatus.AVAILABLE,
  ) =>
    prisma.visitSlot.create({
      data: {
        propertyId,
        startAt: new Date(baseStart().getTime() + offsetHours * 3_600_000),
        endAt: new Date(baseStart().getTime() + (offsetHours + 1) * 3_600_000),
        status,
      },
    });

  it('le chercheur reprogramme une visite CONFIRMED → nouveau slot BOOKED, ancien libéré', async () => {
    const from = await makeSlot(0);
    const to = await makeSlot(24);
    const oldSlotId = from.id;

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);
    expect(booking.status).toBe(VisitBookingStatus.CONFIRMED);

    const moved = await slots.rescheduleVisit(
      seekerUserId,
      booking.id,
      to.id,
    );
    expect(moved.slotId).toBe(to.id);
    expect(moved.status).toBe(VisitBookingStatus.CONFIRMED);

    const slotsAfter = await prisma.visitSlot.findMany({
      where: { propertyId },
      select: { id: true, status: true },
    });
    const byId = new Map(slotsAfter.map((s) => [s.id, s.status]));
    expect(byId.get(oldSlotId)).toBe(VisitSlotStatus.AVAILABLE);
    expect(byId.get(to.id)).toBe(VisitSlotStatus.BOOKED);

    // Le créneau libéré peut être réservé par quelqu'un d'autre (capacité 1).
    const next = await slots.bookVisit(ownerUserId, {
      slotId: oldSlotId,
      propertyId,
    });
    createdBookingIds.push(next.id);
    expect(next.status).toBe(VisitBookingStatus.CONFIRMED);
  });

  it('blackout : un slot BLOCKED est refusé en cible (409) et le booking reste sur son slot', async () => {
    const from = await makeSlot(10);
    const blackout = await makeSlot(34, VisitSlotStatus.BLOCKED);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, blackout.id),
    ).rejects.toBeInstanceOf(ConflictException);

    const b = await prisma.visitBooking.findUnique({
      where: { id: booking.id },
      select: { slotId: true, status: true, rescheduleCount: true },
    });
    expect(b?.slotId).toBe(from.id);
    expect(b?.status).toBe(VisitBookingStatus.CONFIRMED);
    expect(b?.rescheduleCount).toBe(0);
  });

  it('capacité : un slot déjà BOOKED/HELD est refusé en cible (409 SLOT_NOT_AVAILABLE)', async () => {
    const from = await makeSlot(12);
    const taken = await makeSlot(48);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    // Quelqu'un d'autre occupe le créneau cible.
    const other = await slots.bookVisit(ownerUserId, {
      slotId: taken.id,
      propertyId,
    });
    createdBookingIds.push(other.id);

    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, taken.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('un tiers (ni chercheur ni gestionnaire) ne peut pas reprogrammer (403)', async () => {
    const from = await makeSlot(14);
    const to = await makeSlot(60);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    await expect(
      slots.rescheduleVisit(outsiderUserId, booking.id, to.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // La cible est intacte (pas de hold fantôme).
    const target = await prisma.visitSlot.findUnique({
      where: { id: to.id },
      select: { status: true },
    });
    expect(target?.status).toBe(VisitSlotStatus.AVAILABLE);
  });

  it('statuts non reprogrammables : COMPLETED refuse (409 BOOKING_NOT_RESCHEDULABLE)', async () => {
    const booking = await prisma.visitBooking.create({
      data: {
        slotId: (await makeSlot(-72, VisitSlotStatus.BOOKED)).id,
        propertyId,
        userId: seekerUserId,
        status: VisitBookingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    createdBookingIds.push(booking.id);

    const target = await makeSlot(96);
    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, target.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('slot inconnu ou d\u2019un autre bien : 404 SLOT_NOT_FOUND', async () => {
    const from = await makeSlot(16);
    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('même créneau : 400 SAME_SLOT', async () => {
    const from = await makeSlot(18);
    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    await expect(
      slots.rescheduleVisit(seekerUserId, booking.id, from.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('le gestionnaire (owner) peut reprogrammer la visite du chercheur', async () => {
    const from = await makeSlot(20);
    const to = await makeSlot(84);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);

    const moved = await slots.rescheduleVisit(ownerUserId, booking.id, to.id);
    expect(moved.slotId).toBe(to.id);
  });

  it('hold payant PENDING : le hold repart pour 15 min sur le nouveau créneau', async () => {
    const from = await makeSlot(22);
    const to = await makeSlot(108);

    const booking = await slots.bookVisit(seekerUserId, {
      slotId: from.id,
      propertyId,
    });
    createdBookingIds.push(booking.id);
    await prisma.visitBooking.update({
      where: { id: booking.id },
      data: {
        status: VisitBookingStatus.PENDING,
        priceAmount: 5000,
        currency: 'XAF',
        holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    await prisma.visitSlot.update({
      where: { id: from.id },
      data: { status: VisitSlotStatus.HELD },
    });

    const moved = await slots.rescheduleVisit(seekerUserId, booking.id, to.id);
    expect(moved.status).toBe(VisitBookingStatus.PENDING);
    expect(moved.holdExpiresAt).not.toBeNull();

    const newSlot = await prisma.visitSlot.findUnique({
      where: { id: to.id },
      select: { status: true },
    });
    expect(newSlot?.status).toBe(VisitSlotStatus.HELD);
    const oldSlot = await prisma.visitSlot.findUnique({
      where: { id: from.id },
      select: { status: true },
    });
    expect(oldSlot?.status).toBe(VisitSlotStatus.AVAILABLE);

    // Un second appel expire hold via expireHolds ne touche pas le nouveau
    // (hold frais) mais ce booking peut expirer plus tard de façon standard.
    const expired = await slots.expireHolds(new Date(Date.now() + 20 * 60_000));
    expect(expired).toBeGreaterThanOrEqual(1);
    const after = await prisma.visitBooking.findUnique({
      where: { id: booking.id },
      select: { status: true },
    });
    expect(after?.status).toBe(VisitBookingStatus.EXPIRED);
  });
});
