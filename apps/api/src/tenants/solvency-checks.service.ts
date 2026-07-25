import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  SolvencyCheckStatus,
} from '@prisma/client';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';

export type SolvencySnapshotItem = {
  dueDate: string;
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};

export type PublicSolvencyCheck = {
  id: string;
  tenantUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: SolvencyCheckStatus;
  snapshot: SolvencySnapshotItem[] | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const MS_PER_DAY = 86_400_000;
const ACCESS_DAYS = 7;

@Injectable()
export class SolvencyChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
  ) {}

  async create(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<PublicSolvencyCheck> {
    const { organizationId, organizationName } = await this.assertManagedTenant(
      managerUserId,
      tenantUserId,
    );

    const paidCount = await this.countPaidRents(tenantUserId);
    if (paidCount < 1) {
      throw new BadRequestException({
        code: 'NO_PAID_RENTS',
        message: 'Ce locataire n’a aucun loyer payé sur la plateforme',
      });
    }

    const pending = await this.prisma.solvencyCheck.findFirst({
      where: {
        requesterOrgId: organizationId,
        tenantUserId,
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

    const row = await this.prisma.solvencyCheck.create({
      data: {
        tenantUserId,
        requesterUserId: managerUserId,
        requesterOrgId: organizationId,
        status: SolvencyCheckStatus.PENDING,
      },
      include: { organization: { select: { name: true } } },
    });

    await this.events.emit(DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED, {
      checkId: row.id,
      tenantUserId,
      requesterOrgId: organizationId,
      organizationName,
    });

    return this.serialize(row, { includeSnapshot: false });
  }

  async respond(
    tenantUserId: string,
    checkId: string,
    accept: boolean,
  ): Promise<PublicSolvencyCheck> {
    const row = await this.prisma.solvencyCheck.findUnique({
      where: { id: checkId },
      include: { organization: { select: { name: true } } },
    });
    if (!row || row.tenantUserId !== tenantUserId) {
      throw new NotFoundException({
        code: 'SOLVENCY_CHECK_NOT_FOUND',
        message: 'Demande introuvable',
      });
    }
    if (row.status !== SolvencyCheckStatus.PENDING) {
      throw new BadRequestException({
        code: 'SOLVENCY_CHECK_NOT_PENDING',
        message: 'Cette demande a déjà été traitée',
      });
    }

    const now = new Date();
    let snapshot: Prisma.InputJsonValue | undefined;
    let expiresAt: Date | null = null;
    let status: SolvencyCheckStatus = SolvencyCheckStatus.DENIED;

    if (accept) {
      const items = await this.buildSnapshot(tenantUserId);
      snapshot = items as unknown as Prisma.InputJsonValue;
      expiresAt = new Date(now.getTime() + ACCESS_DAYS * MS_PER_DAY);
      status = SolvencyCheckStatus.GRANTED;
    }

    const updated = await this.prisma.solvencyCheck.update({
      where: { id: checkId },
      data: {
        status,
        snapshot: snapshot ?? Prisma.JsonNull,
        respondedAt: now,
        expiresAt,
      },
      include: { organization: { select: { name: true } } },
    });

    return this.serialize(updated, {
      includeSnapshot: status === SolvencyCheckStatus.GRANTED,
    });
  }

  async latestForOrg(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<PublicSolvencyCheck | null> {
    const { organizationId } = await this.assertManagedTenant(
      managerUserId,
      tenantUserId,
    );

    let row = await this.prisma.solvencyCheck.findFirst({
      where: { requesterOrgId: organizationId, tenantUserId },
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });
    if (!row) return null;

    row = await this.expireIfNeeded(row);
    const includeSnapshot =
      row.status === SolvencyCheckStatus.GRANTED &&
      !!row.expiresAt &&
      row.expiresAt.getTime() >= Date.now();

    return this.serialize(row, { includeSnapshot });
  }

  async listForTenant(tenantUserId: string): Promise<PublicSolvencyCheck[]> {
    const rows = await this.prisma.solvencyCheck.findMany({
      where: { tenantUserId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { organization: { select: { name: true } } },
    });

    const ordered = [
      ...rows.filter((r) => r.status === SolvencyCheckStatus.PENDING),
      ...rows.filter((r) => r.status !== SolvencyCheckStatus.PENDING),
    ];

    return ordered.map((row) =>
      this.serialize(row, {
        includeSnapshot: false,
      }),
    );
  }

  private async expireIfNeeded<
    T extends {
      id: string;
      status: SolvencyCheckStatus;
      expiresAt: Date | null;
      organization: { name: string };
    },
  >(row: T): Promise<T> {
    if (
      row.status === SolvencyCheckStatus.GRANTED &&
      row.expiresAt &&
      row.expiresAt.getTime() < Date.now()
    ) {
      const updated = await this.prisma.solvencyCheck.update({
        where: { id: row.id },
        data: { status: SolvencyCheckStatus.EXPIRED },
        include: { organization: { select: { name: true } } },
      });
      return updated as unknown as T;
    }
    return row;
  }

  private async assertManagedTenant(
    managerUserId: string,
    tenantUserId: string,
  ): Promise<{ organizationId: string; organizationName: string }> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }

    const lease = await this.prisma.lease.findFirst({
      where: {
        tenantId: tenantUserId,
        propertyId: { in: propertyIds },
      },
      include: {
        property: {
          select: {
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lease) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Locataire introuvable sur vos biens',
      });
    }

    return {
      organizationId: lease.property.organizationId,
      organizationName: lease.property.organization.name,
    };
  }

  private async countPaidRents(tenantUserId: string): Promise<number> {
    return this.prisma.rentSchedule.count({
      where: {
        status: 'PAID',
        lease: { tenantId: tenantUserId },
      },
    });
  }

  async buildSnapshot(tenantUserId: string): Promise<SolvencySnapshotItem[]> {
    const schedules = await this.prisma.rentSchedule.findMany({
      where: {
        status: 'PAID',
        lease: { tenantId: tenantUserId },
      },
      orderBy: { dueDate: 'desc' },
      take: 3,
      include: {
        payments: {
          include: {
            payment: {
              select: { status: true, validatedAt: true },
            },
          },
        },
      },
    });

    return schedules.map((s) => {
      const validated = s.payments.find(
        (a) => a.payment.status === PaymentStatus.VALIDATED,
      );
      const paidAt =
        validated?.payment.validatedAt ?? s.createdAt;
      const daysLate = Math.max(
        0,
        Math.floor(
          (startOfUtcDay(paidAt).getTime() -
            startOfUtcDay(s.dueDate).getTime()) /
            MS_PER_DAY,
        ),
      );
      return {
        dueDate: s.dueDate.toISOString().slice(0, 10),
        paidAt: paidAt.toISOString(),
        amount: s.amount.toString(),
        currency: s.currency,
        daysLate,
      };
    });
  }

  private serialize(
    row: {
      id: string;
      tenantUserId: string;
      requesterOrgId: string;
      status: SolvencyCheckStatus;
      snapshot: Prisma.JsonValue | null;
      respondedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      organization: { name: string };
    },
    opts: { includeSnapshot: boolean },
  ): PublicSolvencyCheck {
    let snapshot: SolvencySnapshotItem[] | null = null;
    if (opts.includeSnapshot && row.snapshot) {
      snapshot = row.snapshot as unknown as SolvencySnapshotItem[];
    }
    return {
      id: row.id,
      tenantUserId: row.tenantUserId,
      requesterOrgId: row.requesterOrgId,
      organizationName: row.organization.name,
      status: row.status,
      snapshot,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
