import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Conversation,
  ConversationContext,
  ConversationStatus,
  Message,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';

const MESSAGE_MAX_LENGTH = 5000;
/** Suppression par l'auteur sous 5 minutes (spec 10). */
const DELETE_WINDOW_MS = 5 * 60 * 1000;

export interface ConversationAttachment {
  fileKey: string;
  mimeType: string;
  size: number;
  name: string;
}

export interface PublicMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: string;
  body: string | null;
  /** Corps vu par le lecteur : maskedBody quand le numéro est masqué. */
  displayBody: string | null;
  attachments: ConversationAttachment[];
  deletedAt: string | null;
  createdAt: string;
}

export interface PublicConversationSummary {
  id: string;
  contextType: string;
  contextId: string | null;
  propertyId: string | null;
  clientUserId: string;
  organizationId: string | null;
  assignedToId: string | null;
  status: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  unreadCount: number;
  /** Visible côté client : nom de l'orga + agent assigné. */
  counterpart?: {
    organizationName: string | null;
    assignedName: string | null;
  };
}

type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: { messages: true };
}>;

/**
 * Spec 10 — messagerie contextuelle (P1 : flux HTTP, polling au lieu du WS).
 *
 * Unicité : une conversation par (contextType, contextId, clientUserId) —
 * réouvrir le même contexte renvoie l'existant. Côté gestion, la boîte est
 * partagée : les membres de l'org visible par mandat (AgencyAccessService)
 * lisent l'ensemble des conversations de ce bien.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Ouverture / listing
  // -------------------------------------------------------------------------

  /** Crée la conversation du contexte ou renvoie celle déjà ouverte. */
  async openConversation(
    clientUserId: string,
    input: { contextType: ConversationContext; contextId?: string },
  ): Promise<PublicConversationSummary> {
    if (input.contextType === ConversationContext.SUPPORT && input.contextId) {
      throw new BadRequestException({
        code: 'SUPPORT_NO_CONTEXT',
        message: 'La conversation Support n’a pas de contexte métier.',
      });
    }

    const propertyId = await this.resolveContextProperty(
      clientUserId,
      input.contextType,
      input.contextId,
    );
    const existing = await this.findExisting(
      clientUserId,
      input.contextType,
      input.contextId,
    );
    if (existing) return this.toSummary(existing);

    let organizationId: string | null = null;
    if (propertyId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { organizationId: true },
      });
      if (!property) {
        throw new NotFoundException({
          code: 'PROPERTY_NOT_FOUND',
          message: 'Bien introuvable.',
        });
      }
      organizationId = property.organizationId;
    }

    const created = await this.prisma.conversation.create({
      data: {
        contextType: input.contextType,
        contextId: input.contextId,
        propertyId,
        clientUserId,
        organizationId,
        messages: {
          create: {
            kind: 'SYSTEM',
            body:
              input.contextType === ConversationContext.SUPPORT
                ? 'Bienvenue sur le support Paradis Immo — écrivez-nous.'
                : `Conversation ouverte (${input.contextType.toLowerCase()}).`,
          },
        },
      },
      include: { messages: true },
    });
    return this.toSummary(created);
  }

  private async findExisting(
    clientUserId: string,
    contextType: ConversationContext,
    contextId?: string,
  ): Promise<ConversationWithMessages | null> {
    return this.prisma.conversation.findFirst({
      where: {
        clientUserId,
        contextType,
        // null vs undefined distinct in Prisma: SUPPORT has no contextId.
        ...(contextId ? { contextId } : { contextId: null }),
      },
      include: { messages: true },
    });
  }

  /**
   * LEASE / BOOKING / VISIT / MAINTENANCE reference their property transitively;
   * registry of the fields each context model exposes.
   */
  private async resolveContextProperty(
    clientUserId: string,
    contextType: ConversationContext,
    contextId?: string,
  ): Promise<string | null> {
    if (contextType === ConversationContext.SUPPORT) return null;
    if (!contextId?.trim()) {
      throw new BadRequestException({
        code: 'CONTEXT_ID_REQUIRED',
        message: 'Un identifiant de contexte est requis.',
      });
    }

    const notFound = (): never => {
      throw new NotFoundException({
        code: 'CONTEXT_NOT_FOUND',
        message: 'Contexte introuvable.',
      });
    };
    switch (contextType) {
      case ConversationContext.PROPERTY: {
        const property = await this.prisma.property.findUnique({
          where: { id: contextId },
          select: { id: true },
        });
        return property?.id ?? notFound();
      }
      case ConversationContext.LEASE: {
        const lease = await this.prisma.lease.findUnique({
          where: { id: contextId },
          select: {
            propertyId: true,
            tenantId: true,
            coTenants: {
              where: { userId: clientUserId },
              select: { userId: true },
            },
          },
        });
        if (
          !lease ||
          (lease.tenantId !== clientUserId && lease.coTenants.length === 0)
        ) {
          return notFound();
        }
        return lease.propertyId;
      }
      case ConversationContext.BOOKING: {
        const booking = await this.prisma.booking.findUnique({
          where: { id: contextId },
          select: { propertyId: true, userId: true },
        });
        if (!booking || booking.userId !== clientUserId) return notFound();
        return booking.propertyId;
      }
      case ConversationContext.VISIT: {
        const visit = await this.prisma.visitBooking.findUnique({
          where: { id: contextId },
          select: {
            userId: true,
            propertyId: true,
            slot: { select: { propertyId: true } },
          },
        });
        if (!visit || visit.userId !== clientUserId) return notFound();
        return visit.propertyId || visit.slot?.propertyId || notFound();
      }
      case ConversationContext.MAINTENANCE: {
        const ticket = await this.prisma.maintenanceTicket.findUnique({
          where: { id: contextId },
          select: { propertyId: true, reporterId: true },
        });
        if (!ticket || ticket.reporterId !== clientUserId) return notFound();
        return ticket.propertyId;
      }
      case ConversationContext.SALE: {
        const inquiry = await this.prisma.saleInquiry.findUnique({
          where: { id: contextId },
          select: { propertyId: true, userId: true },
        });
        if (!inquiry || inquiry.userId !== clientUserId) return notFound();
        return inquiry.propertyId;
      }
      default:
        return notFound();
    }
  }

  /** Boîte du client : toutes ses conversations, non-lus inclus. */
  async listMine(
    clientUserId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    data: PublicConversationSummary[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(1, pageSize));
    const where: Prisma.ConversationWhereInput = { clientUserId };
    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        include: { messages: true, organization: { select: { name: true } } },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);
    const data = await Promise.all(
      rows.map(async (c) => this.toSummary(c, true)),
    );
    return {
      data,
      meta: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeSize)),
      },
    };
  }

  /**
   * Boîte partagée gestionnaire : conversations des biens sur lesquels le
   * membre a un droit d'opération (owner / gérant / agent assigné via mandat).
   */
  async listManaged(
    managerUserId: string,
    filters: {
      contextType?: ConversationContext;
      propertyId?: string;
      unreadOnly?: boolean;
    },
    page = 1,
    pageSize = 20,
  ): Promise<{
    data: PublicConversationSummary[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const propIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propIds.length === 0) {
      return {
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      };
    }

    const safePage = Math.max(1, page);
    const safeSize = Math.min(50, Math.max(1, pageSize));
    const where: Prisma.ConversationWhereInput = {
      propertyId: { in: propIds },
      ...(filters.contextType ? { contextType: filters.contextType } : {}),
      ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters.unreadOnly
        ? { messages: { some: { deletedAt: null } } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        include: { messages: true },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
    ]);
    const data = await Promise.all(rows.map((c) => this.toSummary(c)));
    return {
      data,
      meta: {
        page: safePage,
        pageSize: safeSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeSize)),
      },
    };
  }

  private async toSummary(
    c: ConversationWithMessages,
    withCounterpart = false,
  ): Promise<PublicConversationSummary> {
    const conversation = c as ConversationWithMessages & {
      organization?: { name: string | null } | null;
    };
    const lastMessage = [...c.messages]
      .filter((m) => m.deletedAt === null)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const unreadCount = lastMessage
      ? await this.countUnread(c.id, c.clientUserId, lastMessage.createdAt)
      : 0;

    let counterpart:
      | { organizationName: string | null; assignedName: string | null }
      | undefined;
    if (withCounterpart) {
      const org = conversation.organization
        ? conversation.organization.name
        : c.organizationId
          ? ((
              await this.prisma.organization.findUnique({
                where: { id: c.organizationId },
                select: { name: true },
              })
            )?.name ?? null)
          : null;
      const assigned = c.assignedToId
        ? ((
            await this.prisma.user.findUnique({
              where: { id: c.assignedToId },
              select: { name: true },
            })
          )?.name ?? null)
        : null;
      counterpart = { organizationName: org, assignedName: assigned };
    }

    return {
      id: c.id,
      contextType: c.contextType,
      contextId: c.contextId,
      propertyId: c.propertyId,
      clientUserId: c.clientUserId,
      organizationId: c.organizationId,
      assignedToId: c.assignedToId,
      status: c.status,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: c.lastMessagePreview,
      createdAt: c.createdAt.toISOString(),
      unreadCount,
      counterpart,
    };
  }

  /** Messages du destinataire écrits après la dernière marque de lecture. */
  private async countUnread(
    conversationId: string,
    clientUserId: string,
    lastMessageAt: Date,
  ): Promise<number> {
    const read = await this.prisma.conversationRead.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: clientUserId },
      },
      select: { lastReadAt: true },
    });
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: clientUserId },
        deletedAt: null,
        createdAt: read ? { gt: read.lastReadAt } : { lte: lastMessageAt },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Accès
  // -------------------------------------------------------------------------

  /**
   * Le client (ou l'un de ses rôles dans l'org côté gestion) peut-il lire ?
   * 403 détaillé : ORG gérée mais l'agent ne couvre plus le bien après retrait
   * du mandat.
   */
  private async assertCanAccess(
    userId: string,
    conversationId: string,
  ): Promise<Conversation> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!c) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation introuvable.',
      });
    }
    if (c.clientUserId === userId) return c;

    if (
      c.propertyId &&
      (await this.agencyAccess.canOperateOnProperty(userId, c.propertyId))
    ) {
      return c;
    }

    throw new ForbiddenException({
      code: 'CONVERSATION_FORBIDDEN',
      message: 'Vous ne participez pas à cette conversation.',
    });
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  async listMessages(
    userId: string,
    conversationId: string,
    query: { before?: string; after?: string; limit?: number },
  ): Promise<{ data: PublicMessage[] }> {
    await this.assertCanAccess(userId, conversationId);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(query.before ? { createdAt: { lt: new Date(query.before) } } : {}),
      ...(query.after ? { createdAt: { gt: new Date(query.after) } } : {}),
    };
    const rows = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { data: rows.map((m) => this.toPublicMessage(m)).reverse() };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    input: { body?: string; attachments?: ConversationAttachment[] },
  ): Promise<PublicMessage> {
    const c = await this.assertCanAccess(userId, conversationId);
    if (c.status !== ConversationStatus.OPEN) {
      throw new BadRequestException({
        code: 'CONVERSATION_CLOSED',
        message: 'Cette conversation est fermée.',
      });
    }
    const body = input.body?.trim();
    if (!body && !input.attachments?.length) {
      throw new BadRequestException({
        code: 'EMPTY_MESSAGE',
        message: 'Le message doit contenir du texte ou des pièces jointes.',
      });
    }
    if (body && body.length > MESSAGE_MAX_LENGTH) {
      throw new BadRequestException({
        code: 'MESSAGE_TOO_LONG',
        message: `Le message ne doit pas dépasser ${MESSAGE_MAX_LENGTH} caractères.`,
      });
    }
    if (input.attachments && input.attachments.length > 5) {
      throw new BadRequestException({
        code: 'TOO_MANY_ATTACHMENTS',
        message: 'Au plus 5 pièces jointes par message.',
      });
    }

    // Masquage des coordonnées : PROPERTY tant que rien ne débloque (P2 doc,
    // implémenté ici carrément : on masque visuellement côté destinataire).
    let maskedBody: string | null = null;
    if (body && c.contextType === ConversationContext.PROPERTY) {
      maskedBody = this.maskContactInfo(body);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          body: body ?? null,
          maskedBody,
          kind: input.attachments?.length ? 'ATTACHMENT' : 'TEXT',
          attachments: input.attachments?.length
            ? (input.attachments as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          lastMessagePreview: (maskedBody ?? body ?? '🧵 pièce jointe').slice(
            0,
            120,
          ),
        },
      });
      return tx.message.findUniqueOrThrow({ where: { id: created.id } });
    });

    this.events.emit(DOMAIN_EVENTS.MESSAGE_CREATED, {
      conversationId,
      messageId: message.id,
      senderId: userId,
      clientUserId: c.clientUserId,
      organizationId: c.organizationId,
    });
    return this.toPublicMessage(message);
  }

  private maskContactInfo(body: string): string {
    // Phones: +242…, 06/07 local formats; emails standard regex.
    let masked = body
      .replace(/(\+?\d[\d\s().-]{7,}\d)/g, (m) =>
        m.replace(/\d(?!\d{0,1}$)/g, '•'),
      )
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '•••@•••');
    if (masked !== body) masked = `« coordonnées masquées » ${masked}`;
    return masked;
  }

  /** Suppression par l'auteur sous 5 minutes — tombstone. */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!m) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: 'Message introuvable.',
      });
    }
    if (m.senderId !== userId) {
      throw new ForbiddenException({
        code: 'MESSAGE_FORBIDDEN',
        message: 'Seul l’auteur peut supprimer son message.',
      });
    }
    if (Date.now() - m.createdAt.getTime() > DELETE_WINDOW_MS) {
      throw new BadRequestException({
        code: 'DELETE_WINDOW_EXPIRED',
        message: 'La suppression n’est possible que dans les 5 minutes.',
      });
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        body: null,
        maskedBody: null,
        attachments: Prisma.JsonNull,
      },
    });
  }

  /** Marque de lecture du client — l'agent assigné notifie « lu ». */
  async markRead(
    userId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<{ ok: true }> {
    await this.assertCanAccess(userId, conversationId);
    await this.prisma.conversationRead.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      create: {
        conversationId,
        userId,
        lastReadAt: new Date(),
        lastReadMessageId: messageId,
      },
      update: {
        lastReadAt: new Date(),
        ...(messageId ? { lastReadMessageId: messageId } : {}),
      },
    });
    return { ok: true };
  }

  async badgeUnreadCount(userId: string): Promise<{ count: number }> {
    const reads = await this.prisma.conversationRead.findMany({
      where: { userId },
      select: {
        conversationId: true,
        lastReadMessageId: true,
        lastReadAt: true,
      },
    });
    const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));
    const convs = await this.prisma.conversation.findMany({
      where: { clientUserId: userId },
      include: {
        messages: {
          where: { senderId: { not: userId }, deletedAt: null },
          select: { createdAt: true },
        },
      },
    });
    let count = 0;
    for (const c of convs) {
      const lastRead = readMap.get(c.id);
      count += c.messages.filter(
        (m) => !lastRead || m.createdAt.getTime() > lastRead.getTime(),
      ).length;
    }
    return { count };
  }

  // -------------------------------------------------------------------------

  private toPublicMessage(m: Message): PublicMessage {
    const attachments = Array.isArray(m.attachments)
      ? (m.attachments as unknown as ConversationAttachment[])
      : [];
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      kind: m.kind,
      body: m.body,
      displayBody:
        m.deletedAt !== null ? 'Message supprimé' : (m.maskedBody ?? m.body),
      attachments: m.deletedAt !== null ? [] : attachments,
      deletedAt: m.deletedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
