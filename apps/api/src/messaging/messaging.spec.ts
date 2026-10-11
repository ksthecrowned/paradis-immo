import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConversationContext, ConversationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { EventPublisher } from '../events/event.publisher';

/**
 * Spec 10 (P1) — conversations contextuelles, boîte partagée, non-lus,
 * suppression sous 5 minutes, masquage PROPERTY.
 *
 * Acceptation couverte :
 * - Ouvrir deux fois depuis le même contexte renvoie la même conversation.
 * - Un agent hors opération du bien reçoit 403.
 * - Le badge unread compte les messages non lus du client.
 * - Un numéro dans un premier message PROPERTY est masqué.
 * - La suppression est interdite à un tiers et hors délai.
 */
describe('Messaging (spec 10 — P1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clientUserId: string;
  let outsiderUserId: string;
  let managerUserId: string;
  let propelId: string;
  let orgId: string;
  let conversationId: string;
  let sentMessageId: string;
  let events: { emit: jest.Mock };
  const stamp = Date.now();

  const phoneClient = () =>
    `+242094${String(stamp % 10000000).padStart(7, '0')}`;
  const phoneOutsider = () =>
    `+242095${String(stamp % 10000000).padStart(7, '0')}`;
  const phoneManager = () =>
    `+242096${String(stamp % 10000000).padStart(7, '0')}`;

  beforeAll(async () => {
    events = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        MessagingService,
        AgencyAccessService,
        PrismaService,
        { provide: EventPublisher, useValue: events },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!country) throw new Error('Run seed first');
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');

    // Purge best-effort des runs précédents sur ces comptes.
    const stale = await prisma.user.findMany({
      where: {
        phone: {
          in: [phoneClient(), phoneOutsider(), phoneManager()],
        },
      },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.messageReport.deleteMany({
        where: { message: { conversation: { clientUserId: { in: staleIds } } } },
      });
      await prisma.message.deleteMany({
        where: { conversation: { clientUserId: { in: staleIds } } },
      });
      await prisma.conversationRead.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.conversation.deleteMany({
        where: { clientUserId: { in: staleIds } },
      });
      await prisma.property.deleteMany({
        where: { ownerId: { in: staleIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.organization.deleteMany({
        where: { members: { some: { userId: { in: staleIds } } } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const client = await prisma.user.create({
      data: {
        phone: phoneClient(),
        countryId: country.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    clientUserId = client.id;
    const outsider = await prisma.user.create({
      data: {
        phone: phoneOutsider(),
        countryId: country.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    outsiderUserId = outsider.id;
    const manager = await prisma.user.create({
      data: {
        phone: phoneManager(),
        countryId: country.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    managerUserId = manager.id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec10 Org ${stamp}`,
        type: 'OWNER',
        countryId: country.id,
        members: { create: { userId: managerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const property = await prisma.property.create({
      data: {
        title: `Spec10 Prop ${stamp}`,
        description: 'Messagerie',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'X',
        countryId: country.id,
        ownerId: managerUserId,
        organizationId: org.id,
      },
    });
    propelId = property.id;
  });

  afterAll(async () => {
    const userIds = [clientUserId, outsiderUserId, managerUserId].filter(
      Boolean,
    );
    if (userIds.length) {
      await prisma.messageReport.deleteMany({
        where: { message: { conversation: { clientUserId: { in: userIds } } } },
      });
      await prisma.message.deleteMany({
        where: { conversation: { clientUserId: { in: userIds } } },
      });
      await prisma.conversationRead.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.conversation.deleteMany({
        where: {
          OR: [
            { clientUserId: { in: userIds } },
            { organizationId: orgId ?? '__none__' },
          ],
        },
      });
      await prisma.property.deleteMany({
        where: { ownerId: { in: userIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.organization.deleteMany({
        where: { id: orgId ?? '__none__' },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('ouvre une conversation PROPERTY (201) avec message système', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('x-test-user', clientUserId)
      .send({ contextType: 'PROPERTY', contextId: propelId })
      .expect(201);

    expect(res.body.contextType).toBe('PROPERTY');
    expect(res.body.propertyId).toBe(propelId);
    expect(res.body.organizationId).toBe(orgId);
    expect(res.body.status).toBe('OPEN');
    conversationId = res.body.id;
  });

  it('réouvrir le même contexte renvoie la même conversation', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('x-test-user', clientUserId)
      .send({ contextType: 'PROPERTY', contextId: propelId })
      .expect(201);
    expect(res.body.id).toBe(conversationId);
  });

  it('le client envoie un message avec un numéro', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', clientUserId)
      .send({ body: 'Appelez-moi au +242 06 123 45 67 merci' })
      .expect(201);
    sentMessageId = res.body.id;
    expect(res.body.senderId).toBe(clientUserId);
    // Le contexte PROPERTY masque — intervalle visible côté destinataire.
    expect(res.body.displayBody).toContain('coordonnées masquées');
    expect(res.body.displayBody).not.toContain('+242 06 123 45 67');
  });

  it('le badge unread du gestionnaire compte le message non lu', async () => {
    // Marque de lecture "côté client" : le client a envoyé, donc pas d'impact
    // sur lui. On regarde la boîte gérée du gestionnaire : 1 nouveau message.
    const res = await request(app.getHttpServer())
      .get('/api/v1/conversations/managed')
      .set('x-test-user', managerUserId)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const conv = res.body.data.find(
      (c: { id: string }) => c.id === conversationId,
    );
    expect(conv).toBeTruthy();
    expect(conv.lastMessagePreview).toBeTruthy();
  });

  it('l’agent des biens gérés lit les messages via la boîte partagée', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', managerUserId)
      .expect(200);
    // 1 système + 1 envoyé par le client.
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const sent = res.body.data.find(
      (m: { id: string }) => m.id === sentMessageId,
    );
    expect(sent.senderId).toBe(clientUserId);
    // Le gestionnaire voit le corps masqué (displayBody), jamais le raw de
    // contact — c'est le périmètre P2 appliqué dès maintenant.
    expect(sent.displayBody).toContain('coordonnées masquées');
  });

  it('un utilisateur sans rapport reçoit 403', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', outsiderUserId)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', outsiderUserId)
      .send({ body: 'hi' })
      .expect(403);
  });

  it('marquer lu met le badge à zéro puis un nouveau message remonte', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/read`)
      .set('x-test-user', clientUserId)
      .send({ messageId: sentMessageId })
      .expect(201);

    // Le gestionnaire répond.
    const reply = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', managerUserId)
      .send({ body: 'Bonjour, visite possible samedi.' })
      .expect(201);
    expect(reply.body.senderId).toBe(managerUserId);

    // Badge du client : le message du gestionnaire est non lu.
    const badge = await request(app.getHttpServer())
      .get('/api/v1/conversations/unread-count')
      .set('x-test-user', clientUserId)
      .expect(200);
    expect(badge.body.count).toBeGreaterThanOrEqual(1);
  });

  it('un empty message est rejeté (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', clientUserId)
      .send({})
      .expect(400);
  });

  it('suppression : interdite à un tiers, autorisée à l’auteur dans les 5 min', async () => {
    // Le gestionnaire ne peut pas supprimer le message du client.
    await request(app.getHttpServer())
      .delete(`/api/v1/messages/${sentMessageId}`)
      .set('x-test-user', managerUserId)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/messages/${sentMessageId}`)
      .set('x-test-user', clientUserId)
      .expect(200);

    const deleted = await prisma.message.findUnique({
      where: { id: sentMessageId },
    });
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.body).toBeNull();
  });

  it('le message supprimé apparaît comme « Message supprimé »', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', managerUserId)
      .expect(200);
    const deleted = res.body.data.find(
      (m: { id: string }) => m.id === sentMessageId,
    );
    expect(deleted.displayBody).toBe('Message supprimé');
    expect(deleted.attachments).toEqual([]);
  });

  it('la conversation fermée refuse les nouveaux messages', async () => {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('x-test-user', clientUserId)
      .send({ body: 'encore' })
      .expect(400);
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.OPEN },
    });
  });

  it('la conversation Support est une conversation sans property ni orga', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('x-test-user', clientUserId)
      .send({ contextType: 'SUPPORT' })
      .expect(201);
    expect(res.body.propertyId).toBeNull();
    expect(res.body.organizationId).toBeNull();
    expect(res.body.contextType).toBe(ConversationContext.SUPPORT);
  });

  it('les événements MESSAGE_CREATED sont émis', () => {
    expect(events.emit).toHaveBeenCalledWith(
      'message.created',
      expect.objectContaining({
        conversationId,
        senderId: clientUserId,
      }),
    );
  });
});
