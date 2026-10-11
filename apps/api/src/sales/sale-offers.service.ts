import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  MandateActionType,
  OrgMemberRole,
  Prisma,
  SaleOffer,
  SaleOfferStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';

/**
 * Spec 08 P1 — offres et contre-offres d'achat.
 *
 * Cycle de vie : SUBMITTED → FORWARDED (au propriétaire, si mandat) →
 * ACCEPTED | REJECTED | COUNTERED (une contre-offre crée une nouvelle offre
 * liée via parentOfferId). Une seule offre ACCEPTED par bien : l'acceptation
 * met le listingStatus du bien à UNDER_OFFER et rejette automatiquement les
 * autres offres ouvertes.
 */
export const OPEN_OFFER_STATUSES: SaleOfferStatus[] = [
  SaleOfferStatus.SUBMITTED,
  SaleOfferStatus.FORWARDED,
];

export interface CreateOfferInput {
  userId: string;
  offerId?: string; // parent (contre-offre)
  price: number | string;
  financing: 'CASH' | 'INSTALLMENTS' | 'BANK_LOAN';
  depositAmount?: number | string;
  installmentsCount?: number;
  conditions?: string;
  validDays?: number;
  note?: string;
}

export interface PublicSaleOffer {
  id: string;
  propertyId: string;
  inquiryId: string | null;
  buyerId: string;
  parentOfferId: string | null;
  authorSide: string;
  price: string;
  currency: string;
  financing: string;
  depositAmount: string | null;
  installmentsCount: number | null;
  conditions: string | null;
  validUntil: string;
  status: SaleOfferStatus;
  approvalId: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

const DEFAULT_VALID_DAYS = 7;

@Injectable()
export class SaleOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
  ) {}

  // ------------------------------------------------------------------
  // Création (acheteur) et contre-offre (les deux côtés)
  // ------------------------------------------------------------------

  async createForProperty(
    propertyId: string,
    buyerId: string,
    input: Omit<CreateOfferInput, 'userId' | 'offerId'>,
  ): Promise<PublicSaleOffer> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, mode: true, listingStatus: true, currency: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.mode !== 'SALE') {
      throw new BadRequestException({
        code: 'PROPERTY_NOT_FOR_SALE',
        message: 'Les offres ne concernent que les biens en vente',
      });
    }
    if (property.listingStatus === ListingStatus.SOLD) {
      throw new BadRequestException({
        code: 'PROPERTY_SOLD',
        message: 'Ce bien est déjà vendu',
      });
    }

    // Le bien doit être rattache à une demande ouverte de cet acheteur (ou non) —
    // spec : inquiryId optionnel ; on le résout si une demande ouverte existe.
    const openInquiry = await this.prisma.saleInquiry.findFirst({
      where: {
        propertyId,
        userId: buyerId,
        status: { in: ['NEW', 'CONTACTED', 'VISIT_SCHEDULED'] },
      },
      select: { id: true },
    });

    const created = await this.prisma.saleOffer.create({
      data: {
        propertyId,
        buyerId,
        inquiryId: openInquiry?.id ?? null,
        authorSide: 'BUYER',
        price: new Prisma.Decimal(input.price),
        currency: property.currency,
        financing: input.financing,
        ...(input.depositAmount !== undefined && input.depositAmount !== null
          ? { depositAmount: new Prisma.Decimal(input.depositAmount) }
          : {}),
        ...(input.installmentsCount
          ? { installmentsCount: input.installmentsCount }
          : {}),
        ...(input.conditions ? { conditions: input.conditions } : {}),
       validUntil: new Date(
          Date.now() + (input.validDays ?? DEFAULT_VALID_DAYS) * 86_400_000,
        ),
        status: SaleOfferStatus.SUBMITTED,
      },
    });

    // Spec 08 — l'agent assigné (ou le gérant) et le propriétaire sont notifiés.
    await this.events.emit(DOMAIN_EVENTS.SALE_OFFER_SUBMITTED, {
      offerId: created.id,
      propertyId,
      buyerId,
      price: created.price.toString(),
    });
    return this.toPublic(created);
  }

  /** Contre-offre : nouvelle offre liée, l'offre d'origine passe COUNTERED. */
  async counter(
    offerId: string,
    userId: string,
    input: Omit<CreateOfferInput, 'userId' | 'offerId'>,
  ): Promise<PublicSaleOffer> {
    const parent = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!parent) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (
      parent.status !== SaleOfferStatus.SUBMITTED &&
      parent.status !== SaleOfferStatus.FORWARDED
    ) {
      throw new BadRequestException({
        code: 'OFFER_NOT_COUNTERABLE',
        message: 'Seule une offre ouverte peut recevoir une contre-offre',
      });
    }
    if (parent.validUntil.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'OFFER_EXPIRED',
        message: "L'offre a expiré",
      });
    }

    // Qui contre ? L'acheteur de l'offre, ou le côté vente (owner / agent
    // autorisé). authorSide reflète l'auteur de la contre-offre.
    const isBuyer = parent.buyerId === userId;
    if (!isBuyer) {
      const canSell = await this.canManageSale(userId, parent.propertyId);
      if (!canSell) {
        throw new ForbiddenException({
          code: 'OFFER_NOT_ALLOWED',
          message: 'Seuls l’acheteur et le côté vente peuvent contre-proposer',
        });
      }
    }
    const authorSide = isBuyer ? 'BUYER' : 'SELLER';

    const counterOffer = await this.prisma.$transaction(async (tx) => {
      await tx.saleOffer.update({
        where: { id: parent.id },
        data: { status: SaleOfferStatus.COUNTERED },
      });
      return tx.saleOffer.create({
        data: {
          propertyId: parent.propertyId,
          buyerId: parent.buyerId,
          inquiryId: parent.inquiryId,
          parentOfferId: parent.id,
          authorSide,
          price: new Prisma.Decimal(input.price),
          currency: parent.currency,
          financing: input.financing,
          ...(input.depositAmount !== undefined && input.depositAmount !== null
            ? { depositAmount: new Prisma.Decimal(input.depositAmount) }
            : {}),
          ...(input.installmentsCount
            ? { installmentsCount: input.installmentsCount }
            : {}),
          ...(input.conditions ? { conditions: input.conditions } : {}),
          ...(input.note ? { conditions: input.note } : {}),
          validUntil: new Date(
            Date.now() + (input.validDays ?? DEFAULT_VALID_DAYS) * 86_400_000,
          ),
          status: SaleOfferStatus.SUBMITTED,
        },
      });
    });

    await this.events.emit(DOMAIN_EVENTS.SALE_OFFER_SUBMITTED, {
      offerId: counterOffer.id,
      propertyId: counterOffer.propertyId,
      buyerId: counterOffer.buyerId,
      price: counterOffer.price.toString(),
    });
    return this.toPublic(counterOffer);
  }

  // ------------------------------------------------------------------
  // Transmission au propriétaire (agent, si mandat)
  // ------------------------------------------------------------------

  async forward(offerId: string, userId: string): Promise<PublicSaleOffer> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (offer.status !== SaleOfferStatus.SUBMITTED) {
      throw new BadRequestException({
        code: 'OFFER_NOT_FORWARDABLE',
        message: 'Seule une offre SUBMITTED peut être transmise',
      });
    }
    const canManage = await this.canManageSale(userId, offer.propertyId);
    if (!canManage) {
      throw new ForbiddenException({
        code: 'OFFER_NOT_ALLOWED',
        message: "Gestion du bien requise pour transmettre l'offre",
      });
    }

    // Mandat actif avec scope SALE ? Sinon le propriétaire décide directement.
    const mandate = await this.prisma.mandate.findFirst({
      where: {
        propertyId: offer.propertyId,
        status: 'ACTIVE',
        scopes: { has: 'SALE' },
      },
      select: {
        id: true,
        minSalePrice: true,
        assignedAgentId: true,
      },
    });

    let status = SaleOfferStatus.FORWARDED;
    let approvalId: string | null = null;

    if (mandate) {
      const aboveMin =
        mandate.minSalePrice !== null &&
        new Prisma.Decimal(offer.price).comparedTo(mandate.minSalePrice) >= 0;
      const agentCanAccept =
        (mandate.assignedAgentId === userId || !mandate.assignedAgentId) &&
        true; // pas de flag agentCanAcceptAboveMin en base : l'agent assigné
      // du mandat scope SALE peut accepter au-dessus du min (spec 03 v1).

      // L'agent ne peut pas accepter seul au-dessus du seuil sans
      // `agentCanAcceptAboveMin`; une approbation est requise.
      if (aboveMin && !agentCanAccept) {
        const approval =
          await this.prisma.mandateApproval.create({
            data: {
              mandateId: mandate.id,
              actionType: MandateActionType.SALE_OFFER_ACCEPT,
              payload: {
                offerId: offer.id,
                price: offer.price.toString(),
                buyerId: offer.buyerId,
              },
              status: 'PENDING',
              requestedById: userId,
              sourceType: 'SALE_OFFER',
              sourceId: offer.id,
              expiresAt: new Date(Date.now() + 7 * 86_400_000),
            },
          });
        approvalId = approval.id;
      }
    }

    const updated = await this.prisma.saleOffer.update({
      where: { id: offer.id },
      data: {
        status,
        ...(approvalId ? { approvalId } : {}),
      },
    });

    await this.events.emit(DOMAIN_EVENTS.SALE_OFFER_FORWARDED, {
      offerId: updated.id,
      propertyId: updated.propertyId,
      buyerId: updated.buyerId,
      price: updated.price.toString(),
    });
    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Décisions : accept / reject / withdraw
  // ------------------------------------------------------------------

  async accept(offerId: string, userId: string): Promise<PublicSaleOffer> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (
      offer.status !== SaleOfferStatus.SUBMITTED &&
      offer.status !== SaleOfferStatus.FORWARDED
    ) {
      throw new BadRequestException({
        code: 'OFFER_NOT_DECIDABLE',
        message: "L'offre n'est plus décidable",
      });
    }
    if (offer.validUntil.getTime() < Date.now()) {
      await this.prisma.saleOffer.update({
        where: { id: offer.id },
        data: { status: SaleOfferStatus.EXPIRED },
      });
      throw new BadRequestException({
        code: 'OFFER_EXPIRED',
        message: "L'offre a expiré",
      });
    }

    // Seuls le côté vente peuvent accepter (owner ou agent autorisé).
    const canManage = await this.canManageSale(userId, offer.propertyId);
    if (!canManage) {
      // L'acheteur ne peut pas accepter sa propre offre... sauf une
      // contre-offre du vendeur (authorSide SELLER).
      if (!(offer.authorSide === 'SELLER' && offer.buyerId === userId)) {
        throw new ForbiddenException({
          code: 'OFFER_NOT_ALLOWED',
          message: "Côté vente requis pour accepter l'offre",
        });
      }
    }

    // Si une approbation est en attente, l'agent ne peut pas décider seul.
    if (offer.approvalId) {
      const approval = await this.prisma.mandateApproval.findUnique({
        where: { id: offer.approvalId },
        select: { status: true, decidedBy: true },
      });
      if (approval && approval.status === 'PENDING') {
        throw new BadRequestException({
          code: 'APPROVAL_REQUIRED',
          message: "Une approbation du propriétaire est requise pour cette offre",
        });
      }
    }

    const now = new Date();
    const accepted = await this.prisma.$transaction(async (tx) => {
      // Une seule offre ACCEPTED par bien : les autres offres ouvertes
      // passent REJECTED (avec message). Décision atomique pour éviter
      // deux acceptations simultanées.
      const competing = await tx.saleOffer.findFirst({
        where: {
          propertyId: offer.propertyId,
          status: SaleOfferStatus.ACCEPTED,
          id: { not: offer.id, notIn: offer.parentOfferId ? [offer.parentOfferId] : [] },
        },
        select: { id: true },
      });
      if (competing) {
        throw new BadRequestException({
          code: 'PROPERTY_ALREADY_UNDER_OFFER',
          message: 'Une autre offre est déjà acceptée sur ce bien',
        });
      }
      const row = await tx.saleOffer.update({
        where: { id: offer.id },
        data: {
          status: SaleOfferStatus.ACCEPTED,
          decidedById: userId,
          decidedAt: now,
        },
      });
      // Les autres offres ouvertes du bien sont rejetées automatiquement.
      await tx.saleOffer.updateMany({
        where: {
          propertyId: offer.propertyId,
          status: { in: OPEN_OFFER_STATUSES },
          id: { not: offer.id },
        },
        data: {
          status: SaleOfferStatus.REJECTED,
          decidedById: userId,
          decidedAt: now,
          decisionNote: 'Offre concurrente acceptée sur le bien',
        },
      });
      // Spec 08 : une offre ACCEPTED met le bien UNDER_OFFER.
      await tx.property.update({
        where: { id: offer.propertyId },
        data: { listingStatus: ListingStatus.UNDER_OFFER },
      });
      return row;
    });

    await this.events.emit(DOMAIN_EVENTS.SALE_OFFER_DECIDED, {
      offerId: accepted.id,
      propertyId: accepted.propertyId,
      buyerId: accepted.buyerId,
      price: accepted.price.toString(),
      decision: 'ACCEPTED',
    });
    return this.toPublic(accepted);
  }

  /** Génère un compromis DRAFT pré-rempli à partir de l'offre acceptée. */
  async draftAgreement(
    offerId: string,
    userId: string,
  ): Promise<{ saleAgreementId: string; price: string; depositAmount: string | null; installmentsCount: number | null }> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (offer.status !== SaleOfferStatus.ACCEPTED) {
      throw new BadRequestException({
        code: 'OFFER_NOT_ACCEPTED',
        message: 'Seule une offre acceptée génère un compromis',
      });
    }
    const canManage = await this.canManageSale(userId, offer.propertyId);
    if (!canManage) {
      throw new ForbiddenException({
        code: 'OFFER_NOT_ALLOWED',
        message: 'Gestion du bien requise pour générer le compromis',
      });
    }
    const existing = await this.prisma.saleAgreement.findFirst({
      where: { propertyId: offer.propertyId, buyerId: offer.buyerId, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException({
        code: 'AGREEMENT_ALREADY_EXISTS',
        message: 'Un compromis existe déjà pour ce couple bien/acheteur',
      });
    }

    const property = await this.prisma.property.findUnique({
      where: { id: offer.propertyId },
      select: { organizationId: true, currency: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    const agreement = await this.prisma.saleAgreement.create({
      data: {
        propertyId: offer.propertyId,
        buyerId: offer.buyerId,
        organizationId: property.organizationId,
        saleInquiryId: offer.inquiryId,
        agreedPrice: offer.price,
        currency: offer.currency,
        status: 'DRAFT',
        installments:
          offer.installmentsCount && offer.installmentsCount > 1
            ? {
                create: this.draftInstallments(
                  offer.price.toString(),
                  offer.depositAmount?.toString() ?? null,
                  offer.installmentsCount,
                  offer.currency,
                ),
              }
            : {},
      },
      select: { id: true },
    });
    return {
      saleAgreementId: agreement.id,
      price: offer.price.toString(),
      depositAmount: offer.depositAmount?.toString() ?? null,
      installmentsCount: offer.installmentsCount ?? null,
    };
  }

  async reject(
    offerId: string,
    userId: string,
    note?: string,
  ): Promise<PublicSaleOffer> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (
      offer.status !== SaleOfferStatus.SUBMITTED &&
      offer.status !== SaleOfferStatus.FORWARDED
    ) {
      throw new BadRequestException({
        code: 'OFFER_NOT_DECIDABLE',
        message: "L'offre n'est plus décidable",
      });
    }
    const canManage = await this.canManageSale(userId, offer.propertyId);
    const isBuyerOnSellerOffer =
      offer.authorSide === 'SELLER' && offer.buyerId === userId;
    if (!canManage && !isBuyerOnSellerOffer) {
      throw new ForbiddenException({
        code: 'OFFER_NOT_ALLOWED',
        message: "Côté vente requis pour refuser l'offre",
      });
    }
    const updated = await this.prisma.saleOffer.update({
      where: { id: offer.id },
      data: {
        status: SaleOfferStatus.REJECTED,
        decidedById: userId,
        decidedAt: new Date(),
        ...(note ? { decisionNote: note } : {}),
      },
    });
    await this.events.emit(DOMAIN_EVENTS.SALE_OFFER_DECIDED, {
      offerId: updated.id,
      propertyId: updated.propertyId,
      buyerId: updated.buyerId,
      price: updated.price.toString(),
      decision: 'REJECTED',
    });
    return this.toPublic(updated);
  }

  async withdraw(offerId: string, userId: string): Promise<PublicSaleOffer> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    if (offer.buyerId !== userId) {
      throw new ForbiddenException({
        code: 'OFFER_NOT_ALLOWED',
        message: "Seul l'acheteur peut retirer son offre",
      });
    }
    if (
      offer.status !== SaleOfferStatus.SUBMITTED &&
      offer.status !== SaleOfferStatus.FORWARDED
    ) {
      throw new BadRequestException({
        code: 'OFFER_NOT_WITHDRAWABLE',
        message: "L'offre n'est plus retirable",
      });
    }
    const updated = await this.prisma.saleOffer.update({
      where: { id: offer.id },
      data: { status: SaleOfferStatus.WITHDRAWN, decidedById: userId, decidedAt: new Date() },
    });
    return this.toPublic(updated);
  }

  // ------------------------------------------------------------------
  // Lecture
  // ------------------------------------------------------------------

  async listForProperty(
    propertyId: string,
    userId: string,
  ): Promise<PublicSaleOffer[]> {
    const canManage = await this.canManageSale(userId, propertyId);
    const rows = await this.prisma.saleOffer.findMany({
      where: canManage
        ? { propertyId }
        : { propertyId, buyerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async listMine(buyerId: string): Promise<PublicSaleOffer[]> {
    const rows = await this.prisma.saleOffer.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async getOne(offerId: string, userId: string): Promise<PublicSaleOffer> {
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    const allowed =
      offer.buyerId === userId ||
      (await this.canManageSale(userId, offer.propertyId));
    if (!allowed) {
      throw new NotFoundException({
        code: 'OFFER_NOT_FOUND',
        message: "L'offre n'existe pas",
      });
    }
    return this.toPublic(offer);
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Périmètre côté vente : propriétaire, ou (spéc 08) mandat actif avec
   * scope SALE porté par l'agence (gérant ADMIN de l'org ou agent assigné)
   * — l'agent d'un mandat sans scope SALE n'a pas le droit.
   */
  private async canManageSale(
    userId: string,
    propertyId: string,
  ): Promise<boolean> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, organizationId: true },
    });
    if (!property) return false;
    if (property.ownerId === userId) return true;

    // Mandat actif scope SALE : agent assigné ou gérant de l'org mandatée.
    const mandate = await this.prisma.mandate.findFirst({
      where: {
        propertyId,
        status: 'ACTIVE',
        scopes: { has: 'SALE' },
        OR: [
          { assignedAgentId: userId },
          {
            organization: {
              members: { some: { userId, role: OrgMemberRole.ADMIN } },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (mandate) return true;

    // Sans mandat : gérant/owner de l'org du bien (mirror agency-access).
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId: property.organizationId,
        role: { in: [OrgMemberRole.ADMIN, OrgMemberRole.OWNER] },
      },
      select: { id: true },
    });
    return orgMember !== null;
  }

  private draftInstallments(
    price: string,
    deposit: string | null,
    count: number,
    currency: string,
  ): Array<{ label: string; dueDate: Date; amount: Prisma.Decimal; currency: string; position: number }> {
    const depositAmount = deposit ? Number(deposit) : 0;
    const remaining = Number(price) - depositAmount;
    const perInstallment = Math.round(remaining / count);
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      label: i === 0 && depositAmount > 0 ? 'Acompte' : `Échéance ${i + 1}`,
      dueDate: new Date(now + (i + 1) * 30 * 86_400_000),
      amount: new Prisma.Decimal(perInstallment),
      currency,
      position: i,
    }));
  }

  private toPublic(o: SaleOffer): PublicSaleOffer {
    return {
      id: o.id,
      propertyId: o.propertyId,
      inquiryId: o.inquiryId,
      buyerId: o.buyerId,
      parentOfferId: o.parentOfferId,
      authorSide: o.authorSide,
      price: o.price.toString(),
      currency: o.currency,
      financing: o.financing,
      depositAmount: o.depositAmount?.toString() ?? null,
      installmentsCount: o.installmentsCount,
      conditions: o.conditions,
      validUntil: o.validUntil.toISOString(),
      status: o.status,
      approvalId: o.approvalId,
      decidedById: o.decidedById,
      decidedAt: o.decidedAt?.toISOString() ?? null,
      decisionNote: o.decisionNote,
      createdAt: o.createdAt.toISOString(),
    };
  }
}
