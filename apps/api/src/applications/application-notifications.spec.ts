import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { LeasesService } from '../leases/leases.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RentalApplicationsService } from './rental-applications.service';
import { ApplicationNotificationsProcessor } from './application-notifications.processor';

/**
 * Spec 04 P1 — the candidature decision must actually reach the candidate.
 *
 * The service only emits domain events; this suite wires the real event bus
 * and asserts a notification is produced for the winner, for the candidates
 * auto-rejected when the winner was accepted, and on withdrawal.
 */
describe('Application notifications (spec 04 P1)', () => {
  let prisma: PrismaService;
  let applications: RentalApplicationsService;
  let sent: { userId: string; type: string; payload: Record<string, unknown> }[];

  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
  let orgId: string;

  const phones = ['+242076770001', '+242076770002', '+242076770003'];
  let applicantIds: string[] = [];
  const orgName = `App Notif Org ${Date.now()}`;

  const notificationsStub = {
    send: jest.fn(
      async (input: {
        userId: string;
        type: string;
        payload: Record<string, unknown>;
      }): Promise<never> => {
        sent.push({
          userId: input.userId,
          type: input.type,
          payload: input.payload,
        });
        // The processor only awaits the call; the payload is never read here.
        return undefined as never;
      },
    ),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      // A real event bus is required for the processor's @OnEvent handlers
      // to be registered at all.
      imports: [EventEmitterModule.forRoot()],
      providers: [
        PrismaService,
        EventPublisher,
        AgencyAccessService,
        RentalApplicationsService,
        ApplicationNotificationsProcessor,
        { provide: NotificationsService, useValue: notificationsStub },
        {
          provide: LeasesService,
          useValue: {
            createLease: jest.fn(async () => {
              return prisma.lease.create({
                data: {
                  propertyId,
                  tenantId: applicantIds[0],
                  startDate: new Date('2030-01-01'),
                  endDate: new Date('2030-12-31'),
                  monthlyRent: new Prisma.Decimal(100000),
                  deposit: new Prisma.Decimal(200000),
                  currency: 'XAF',
                  status: 'DRAFT',
                  dueDay: 1,
                },
              });
            }),
          },
        },
      ],
    }).compile();
    applications = moduleRef.get(RentalApplicationsService);
    prisma = moduleRef.get(PrismaService);
    // `@OnEvent` handlers are wired in onApplicationBootstrap, which a
    // TestingModule only runs on init(). Without this the processor never
    // listens and nothing is ever sent.
    await moduleRef.init();
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    await prisma.organization.deleteMany({ where: { name: { startsWith: 'App Notif Org' } } });
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        countryId,
        name: 'Notif Owner',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    applicantIds = [];
    for (const phone of phones.slice(1)) {
      const u = await prisma.user.create({
        data: {
          phone,
          countryId,
          name: `Notif Applicant ${phone.slice(-2)}`,
          roles: { create: { role: 'TENANT' } },
        },
      });
      applicantIds.push(u.id);
    }

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'App Notif Property',
        description: 'Notifications de candidature',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'App Notif',
        countryId,
        status: 'ACTIVE',
        ownerId: ownerUserId,
        organizationId: orgId,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    const leases = await prisma.lease.findMany({
      where: { propertyId },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);
    if (leaseIds.length) {
      await prisma.rentSchedule.deleteMany({ where: { leaseId: { in: leaseIds } } });
      await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
    }
    await prisma.rentalApplication.deleteMany({ where: { propertyId } });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.documentSequence.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMember.deleteMany({ where: { userId: ownerUserId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    const allUsers = [ownerUserId, ...applicantIds].filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: allUsers } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: allUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: allUsers } } });
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    sent = [];
    notificationsStub.send.mockClear();
    await prisma.solvencyCheck.deleteMany({ where: { application: { propertyId } } });
    await prisma.rentalApplication.deleteMany({ where: { propertyId } });
  });

  const dto = (occupants = 2) => ({
    desiredMoveIn: '2030-03-01',
    occupants,
  });

  it('notifies the candidate when they apply', async () => {
    await applications.apply(applicantIds[0], propertyId, dto());
    expect(sent).toHaveLength(1);
    expect(sent[0].userId).toBe(applicantIds[0]);
    expect(sent[0].type).toBe('APPLICATION_SUBMITTED');
    expect(sent[0].payload.propertyTitle).toBe('App Notif Property');
  });

  it('notifies the winner and the auto-rejected losers on acceptance', async () => {
    const winner = await applications.apply(applicantIds[0], propertyId, dto());
    const loser = await applications.apply(applicantIds[1], propertyId, dto());

    sent = [];
    await applications.decide(ownerUserId, winner.id, {
      status: 'ACCEPTED',
      rejectionMessage: 'Bien attribué à un autre candidat.',
    });

    const accepted = sent.filter((s) => s.type === 'APPLICATION_ACCEPTED');
    expect(accepted).toHaveLength(1);
    expect(accepted[0].userId).toBe(applicantIds[0]);
    expect(accepted[0].payload.propertyTitle).toBe('App Notif Property');

    const rejected = sent.filter((s) => s.type === 'APPLICATION_REJECTED');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].userId).toBe(applicantIds[1]);
    // The customisable message is what the loser is actually told.
    expect(rejected[0].payload.rejectionMessage).toBe(
      'Bien attribué à un autre candidat.',
    );
    expect(rejected[0].payload.applicationId).toBe(loser.id);
  });

  it('notifies the candidate when they withdraw', async () => {
    const created = await applications.apply(applicantIds[0], propertyId, dto());
    sent = [];
    await applications.withdraw(applicantIds[0], created.id);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('APPLICATION_WITHDRAWN');
    expect(sent[0].userId).toBe(applicantIds[0]);
  });

  it('notifies the candidate when explicitly rejected', async () => {
    const created = await applications.apply(applicantIds[0], propertyId, dto());
    sent = [];
    await applications.decide(ownerUserId, created.id, {
      status: 'REJECTED',
      rejectionMessage: 'Dossier incomplet.',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('APPLICATION_REJECTED');
    expect(sent[0].payload.rejectionMessage).toBe('Dossier incomplet.');
  });
});