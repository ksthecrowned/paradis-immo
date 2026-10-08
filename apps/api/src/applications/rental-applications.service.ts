import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  ListingStatus,
  Prisma,
  PropertyMode,
  SolvencyCheckStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { LeasesService } from '../leases/leases.service';
import type { CreateApplicationDto } from './dto/create-application.dto';
import type { ListApplicationsDto } from './dto/list-applications.dto';
import type { UpdateApplicationDto } from './dto/update-application.dto';
import type { CreateApplicationLeaseDto } from './dto/create-application-lease.dto';
import type { PublicLease } from '../leases/leases.service';
import type { PublicSolvencyCheck } from '../tenants/solvency-checks.service';

/** Statuses from which a candidate may still withdraw. */
const WITHDRAWABLE: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.SOLVENCY_PENDING,
];

const DEFAULT_LEASE_MONTHS = 36;

export interface PublicApplication {
  id: string;
  propertyId: string;
  applicantId: string;
  desiredMoveIn: string;
  occupants: number;
  occupation: string | null;
  declaredIncome: string | null;
  message: string | null;
  status: ApplicationStatus;
  rejectionMessage: string | null;
  decidedById: string | null;
  decidedAt: string | null;
  leaseId: string | null;
  createdAt: string;
  /** Only for manager-facing reads. */
  applicant?: { id: string; name: string | null; phone: string | null };
  property?: {
    id: string;
    title: string;
    address: string;
    price: string;
    currency: string;
  };
  /** Solvency consent state attached to this candidature. */
  solvencyCheck?: {
    id: string;
    status: SolvencyCheckStatus;
    expiresAt: string | null;
  } | null;
}

export interface PaginatedApplications {
  data: PublicApplication[];
  meta: { total: number; page: number; pageSize: number };
}

/**
 * Spec 04 — candidatures (rental applications).
 *
 * A candidature is the entry point of the long-rental funnel: a seeker
 * applies on a `RENT_LONG` property, the manager asks for a solvency
 * consent, and accepting one pre-fills a DRAFT lease while automatically
 * rejecting every sibling candidature on the same property.
 */
@Injectable()
export class RentalApplicationsService {
  private readonly logger = new Logger(RentalApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
    private readonly leases: LeasesService,
  ) {}

  /** POST `properties/:id/applications` — a seeker applies. */
  async apply(
    applicantId: string,
    propertyId: string,
    dto: CreateApplicationDto,
  ): Promise<PublicApplication> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        mode: true,
        listingStatus: true,
        ownerId: true,
        organizationId: true,
      },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Annonce introuvable',
      });
    }
    if (property.mode !== PropertyMode.RENT_LONG) {
      throw new BadRequestException({
        code: 'NOT_RENT_LONG',
        message: 'Les candidatures sont réservées aux locations longue durée',
      });
    }
    if (property.listingStatus === ListingStatus.OCCUPIED) {
      throw new ConflictException({
        code: 'PROPERTY_OCCUPIED',
        message: 'Ce bien n’est plus disponible',
      });
    }
    if (property.ownerId === applicantId) {
      throw new ForbiddenException({
        code: 'CANNOT_APPLY_OWN_PROPERTY',
        message: 'Vous ne pouvez pas postuler sur votre propre bien',
      });
    }

    const desiredMoveIn = new Date(dto.desiredMoveIn);
    if (Number.isNaN(desiredMoveIn.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_MOVE_IN_DATE',
        message: 'desiredMoveIn doit être une date valide',
      });
    }

    const existing = await this.prisma.rentalApplication.findUnique({
      where: {
        propertyId_applicantId: { propertyId, applicantId },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      // A withdrawn or rejected candidature can be revived, anything else is
      // a duplicate the candidate must not create.
      if (
        existing.status !== ApplicationStatus.WITHDRAWN &&
        existing.status !== ApplicationStatus.REJECTED
      ) {
        throw new ConflictException({
          code: 'APPLICATION_EXISTS',
          message: 'Vous avez déjà candidature sur ce bien',
        });
      }
      const row = await this.prisma.rentalApplication.update({
        where: { id: existing.id },
        data: {
          desiredMoveIn,
          occupants: dto.occupants,
          occupation: dto.occupation ?? null,
          declaredIncome:
            dto.declaredIncome === undefined
              ? null
              : new Prisma.Decimal(dto.declaredIncome),
          message: dto.message ?? null,
          status: ApplicationStatus.SUBMITTED,
          rejectionMessage: null,
          decidedById: null,
          decidedAt: null,
        },
      });
      this.logger.log(`Application ${row.id} re-submitted by ${applicantId}`);
      await this.events.emit(DOMAIN_EVENTS.APPLICATION_SUBMITTED, {
        applicationId: row.id,
        propertyId,
        applicantId,
        organizationId: property.organizationId,
        propertyTitle: property.title,
      });
      return this.toPublic(row);
    }

    const row = await this.prisma.rentalApplication.create({
      data: {
        propertyId,
        applicantId,
        desiredMoveIn,
        occupants: dto.occupants,
        occupation: dto.occupation ?? null,
        declaredIncome:
          dto.declaredIncome === undefined
            ? null
            : new Prisma.Decimal(dto.declaredIncome),
        message: dto.message ?? null,
      },
    });
    this.logger.log(`Application ${row.id} on property ${propertyId}`);

    await this.events.emit(DOMAIN_EVENTS.APPLICATION_SUBMITTED, {
      applicationId: row.id,
      propertyId,
      applicantId,
      organizationId: property.organizationId,
      propertyTitle: property.title,
    });

    return this.toPublic(row);
  }

  /** GET `applications/mine` — every candidature the caller submitted. */
  async listMine(applicantId: string): Promise<PublicApplication[]> {
    const rows = await this.prisma.rentalApplication.findMany({
      where: { applicantId },
      orderBy: { createdAt: 'desc' },
      include: this.managerInclude(),
    });
    return rows.map((row) => this.toPublic(row, true));
  }

  /** DELETE `applications/:id` — the candidate withdraws. */
  async withdraw(applicantId: string, applicationId: string) {
    const row = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: {
        property: { select: { organizationId: true } },
      },
    });
    if (!row || row.applicantId !== applicantId) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Candidature introuvable',
      });
    }
    if (!WITHDRAWABLE.includes(row.status)) {
      throw new ConflictException({
        code: 'APPLICATION_NOT_WITHDRAWABLE',
        message: 'Cette candidature n’est plus retirable',
      });
    }

    const updated = await this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.WITHDRAWN },
    });

    await this.events.emit(DOMAIN_EVENTS.APPLICATION_WITHDRAWN, {
      applicationId,
      propertyId: row.propertyId,
      applicantId,
      organizationId: row.property.organizationId,
    });

    return this.toPublic(updated);
  }

  /** GET `properties/:id/applications` — paginated manager view. */
  async listForProperty(
    managerUserId: string,
    propertyId: string,
    filter: ListApplicationsDto,
  ): Promise<PaginatedApplications> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Annonce introuvable',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(managerUserId, propertyId);

    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const where: Prisma.RentalApplicationWhereInput = {
      propertyId,
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.rentalApplication.count({ where }),
      this.prisma.rentalApplication.findMany({
        where,
        // Accepted first, then the freshest: the manager works the list
        // top-down and wants the decided ones out of the way.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.managerInclude(),
      }),
    ]);
    return {
      data: rows.map((row) => this.toPublic(row, true)),
      meta: { total, page, pageSize },
    };
  }

  /**
   * PATCH `applications/:id` — manager decision.
   *
   * Accepting one candidature rejects every other open candidature on the
   * same property with the (customisable) `rejectionMessage`.
   */
  async decide(
    managerUserId: string,
    applicationId: string,
    dto: UpdateApplicationDto,
  ): Promise<PublicApplication> {
    const existing = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, propertyId: true, applicantId: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Candidature introuvable',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      existing.propertyId,
    );
    if (
      existing.status === ApplicationStatus.ACCEPTED ||
      existing.status === ApplicationStatus.WITHDRAWN
    ) {
      throw new ConflictException({
        code: 'APPLICATION_ALREADY_DECIDED',
        message: 'Cette candidature a déjà été tranchée',
      });
    }

    if (dto.status === ApplicationStatus.REJECTED && !dto.rejectionMessage) {
      throw new BadRequestException({
        code: 'REJECTION_MESSAGE_REQUIRED',
        message: 'Un motif est obligatoire pour refuser une candidature',
      });
    }

    const decidedAt = new Date();
    const updated = await this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        rejectionMessage:
          dto.status === ApplicationStatus.REJECTED
            ? (dto.rejectionMessage ?? null)
            : null,
        decidedById: managerUserId,
        decidedAt,
      },
    });

    if (dto.status === ApplicationStatus.ACCEPTED) {
      const autoRejectedIds = await this.autoRejectSiblings({
        propertyId: existing.propertyId,
        keepId: applicationId,
        managerUserId,
        message:
          dto.rejectionMessage ??
          'Le bien a été attribué à un autre candidat.',
        decidedAt,
      });
      await this.events.emit(DOMAIN_EVENTS.APPLICATION_ACCEPTED, {
        applicationId,
        propertyId: existing.propertyId,
        applicantId: existing.applicantId,
        autoRejectedIds,
      });
    } else if (dto.status === ApplicationStatus.REJECTED) {
      await this.events.emit(DOMAIN_EVENTS.APPLICATION_REJECTED, {
        applicationId,
        applicantId: existing.applicantId,
        rejectionMessage: dto.rejectionMessage ?? null,
        auto: false,
      });
    }

    return this.toPublic(updated);
  }

  /**
   * POST `applications/:id/solvency-checks` — ask the candidate for consent.
   *
   * Spec 04: `SolvencyCheck` may target a candidature rather than an
   * existing tenant, with the same consent and the same expiry window.
   */
  async requestSolvencyCheck(
    managerUserId: string,
    applicationId: string,
  ): Promise<PublicSolvencyCheck> {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: {
        property: {
          select: {
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Candidature introuvable',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      application.propertyId,
    );
    if (
      application.status === ApplicationStatus.WITHDRAWN ||
      application.status === ApplicationStatus.REJECTED
    ) {
      throw new ConflictException({
        code: 'APPLICATION_CLOSED',
        message: 'Cette candidature est close',
      });
    }

    const pending = await this.prisma.solvencyCheck.findFirst({
      where: {
        applicationId,
        status: SolvencyCheckStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException({
        code: 'PENDING_EXISTS',
        message: 'Une demande de solvabilité est déjà en attente',
      });
    }

    const organizationId = application.property.organizationId;
    const check = await this.prisma.$transaction(async (tx) => {
      const created = await tx.solvencyCheck.create({
        data: {
          tenantUserId: application.applicantId,
          applicationId,
          requesterUserId: managerUserId,
          requesterOrgId: organizationId,
          status: SolvencyCheckStatus.PENDING,
        },
        include: { organization: { select: { name: true } } },
      });
      await tx.rentalApplication.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.SOLVENCY_PENDING },
      });
      return created;
    });

    await this.events.emit(DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED, {
      checkId: check.id,
      tenantUserId: application.applicantId,
      requesterOrgId: organizationId,
      organizationName: application.property.organization.name,
      applicationId,
    });

    return {
      id: check.id,
      tenantUserId: check.tenantUserId,
      applicationId,
      requesterOrgId: check.requesterOrgId,
      organizationName: check.organization.name,
      status: check.status,
      snapshot: null,
      respondedAt: check.respondedAt?.toISOString() ?? null,
      expiresAt: check.expiresAt?.toISOString() ?? null,
      createdAt: check.createdAt.toISOString(),
    };
  }

  /**
   * POST `applications/:id/lease` — turn an ACCEPTED candidature into a
   * DRAFT lease pre-filled from the candidature and the listing.
   */
  async createLeaseFromApplication(
    managerUserId: string,
    applicationId: string,
    dto: CreateApplicationLeaseDto,
  ): Promise<PublicLease> {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            currency: true,
          },
        },
        applicant: { select: { id: true, phone: true } },
      },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Candidature introuvable',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerUserId,
      application.propertyId,
    );
    if (application.status !== ApplicationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'APPLICATION_NOT_ACCEPTED',
        message: 'Seule une candidature acceptée peut générer un bail',
      });
    }
    if (application.leaseId) {
      throw new ConflictException({
        code: 'APPLICATION_ALREADY_HAS_LEASE',
        message: 'Un bail a déjà été créé pour cette candidature',
      });
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : application.desiredMoveIn;
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : addUtcMonths(startDate, DEFAULT_LEASE_MONTHS);
    if (endDate <= startDate) {
      throw new BadRequestException({
        code: 'INVALID_LEASE_DATES',
        message: 'endDate doit être postérieure à startDate',
      });
    }

    const monthlyRent =
      dto.monthlyRent ?? Number(application.property.price.toString());
    const deposit = dto.deposit ?? monthlyRent * 2;

    const lease = await this.leases.createLease(managerUserId, {
      propertyId: application.propertyId,
      tenantId: application.applicantId,
      invitedPhone: application.applicant.phone ?? undefined,
      startDate,
      endDate,
      monthlyRent,
      deposit,
      currency: application.property.currency,
      ...(dto.dueDay ? { dueDay: dto.dueDay } : {}),
    });

    await this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: { leaseId: lease.id },
    });

    this.logger.log(
      `DRAFT lease ${lease.id} created from application ${applicationId}`,
    );
    return lease;
  }

  /**
   * Called by `SolvencyDecidedProcessor` when a candidate answers a
   * candidature-targeted consent request: the candidature goes back under
   * review, whatever the answer.
   */
  async onSolvencyDecided(applicationId: string): Promise<void> {
    const application = await this.prisma.rentalApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true },
    });
    if (!application) return;
    // A decision taken by the manager after the request was sent (accept /
    // reject / withdraw) must not be overwritten by the late answer.
    if (application.status !== ApplicationStatus.SOLVENCY_PENDING) return;
    await this.prisma.rentalApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.UNDER_REVIEW },
    });
    this.logger.log(`Application ${applicationId} back to UNDER_REVIEW`);
  }

  /** Reject every other open candidature on the property. */
  private async autoRejectSiblings(input: {
    propertyId: string;
    keepId: string;
    managerUserId: string;
    message: string;
    decidedAt: Date;
  }): Promise<string[]> {
    const siblings = await this.prisma.rentalApplication.findMany({
      where: {
        propertyId: input.propertyId,
        id: { not: input.keepId },
        status: {
          in: [
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.SOLVENCY_PENDING,
          ],
        },
      },
      select: { id: true, applicantId: true },
    });
    if (siblings.length === 0) return [];

    const ids = siblings.map((s) => s.id);
    await this.prisma.rentalApplication.updateMany({
      where: { id: { in: ids } },
      data: {
        status: ApplicationStatus.REJECTED,
        rejectionMessage: input.message,
        decidedById: input.managerUserId,
        decidedAt: input.decidedAt,
      },
    });

    for (const sibling of siblings) {
      await this.events.emit(DOMAIN_EVENTS.APPLICATION_REJECTED, {
        applicationId: sibling.id,
        applicantId: sibling.applicantId,
        rejectionMessage: input.message,
        auto: true,
      });
    }
    this.logger.log(
      `Auto-rejected ${ids.length} sibling application(s) on ${input.propertyId}`,
    );
    return ids;
  }

  private managerInclude() {
    return {
      applicant: { select: { id: true, name: true, phone: true } },
      property: {
        select: {
          id: true,
          title: true,
          price: true,
          currency: true,
          address: true,
        },
      },
      solvencyChecks: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: { id: true, status: true, expiresAt: true },
      },
    };
  }

  private toPublic(
    row: {
      id: string;
      propertyId: string;
      applicantId: string;
      desiredMoveIn: Date;
      occupants: number;
      occupation: string | null;
      declaredIncome: Prisma.Decimal | null;
      message: string | null;
      status: ApplicationStatus;
      rejectionMessage: string | null;
      decidedById: string | null;
      decidedAt: Date | null;
      leaseId: string | null;
      createdAt: Date;
      applicant?: { id: string; name: string | null; phone: string | null };
      property?: {
        id: string;
        title: string;
        price: Prisma.Decimal;
        currency: string;
        address: string;
      };
      solvencyChecks?: {
        id: string;
        status: SolvencyCheckStatus;
        expiresAt: Date | null;
      }[];
    },
    withDetails = false,
  ): PublicApplication {
    const latest = row.solvencyChecks?.[0];
    return {
      id: row.id,
      propertyId: row.propertyId,
      applicantId: row.applicantId,
      desiredMoveIn: row.desiredMoveIn.toISOString(),
      occupants: row.occupants,
      occupation: row.occupation,
      declaredIncome: row.declaredIncome
        ? row.declaredIncome.toString()
        : null,
      message: row.message,
      status: row.status,
      rejectionMessage: row.rejectionMessage,
      decidedById: row.decidedById,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      leaseId: row.leaseId,
      createdAt: row.createdAt.toISOString(),
      ...(withDetails && row.applicant
        ? {
            applicant: {
              id: row.applicant.id,
              name: row.applicant.name,
              phone: row.applicant.phone,
            },
          }
        : {}),
      ...(withDetails && row.property
        ? {
            property: {
              id: row.property.id,
              title: row.property.title,
              address: row.property.address,
              price: row.property.price.toString(),
              currency: row.property.currency,
            },
          }
        : {}),
      ...(withDetails
        ? {
            solvencyCheck: latest
              ? {
                  id: latest.id,
                  status: latest.status,
                  expiresAt: latest.expiresAt?.toISOString() ?? null,
                }
              : null,
          }
        : {}),
    };
  }
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );
}