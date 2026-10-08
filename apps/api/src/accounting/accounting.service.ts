import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, OrgMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../media/r2.service';
import { renderStatementPdf } from './statement-pdf';

export interface RangeFilter {
  from?: Date;
  to?: Date;
  propertyId?: string;
}

interface LedgerScope {
  ownerOrgIds: string[];
  propertyIds?: string[];
}

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  /**
   * GET accounting/owner/summary — totals per entry type for the owner's
   * properties over a period (spec 03 US 12).
   */
  async ownerSummary(
    userId: string,
    filter: RangeFilter,
  ): Promise<{
    totals: Record<string, string>;
    net: string;
    currency: string;
    count: number;
  }> {
    const scope = await this.ownerScope(userId, filter);
    if (scope.ownerOrgIds.length === 0) {
      return { totals: {}, net: '0', currency: 'XAF', count: 0 };
    }
    const where = this.rangeWhere(scope, filter);
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: { amount: true },
    });

    const totals: Record<string, string> = {};
    let net = new Prisma.Decimal(0);
    let count = 0;
    for (const row of grouped) {
      const sum = row._sum.amount ?? new Prisma.Decimal(0);
      totals[row.type] = sum.toString();
      net = net.add(sum);
      count += row._count.amount;
    }
    const first = await this.prisma.ledgerEntry.findFirst({
      where,
      select: { currency: true },
      orderBy: { occurredAt: 'asc' },
    });
    return {
      totals,
      net: net.toString(),
      currency: first?.currency ?? 'XAF',
      count,
    };
  }

  /** GET accounting/owner/ledger — paginated entries (US 12). */
  async ownerLedger(
    userId: string,
    filter: RangeFilter & { page?: number; pageSize?: number },
  ): Promise<{
    data: Array<Record<string, unknown>>;
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const scope = await this.ownerScope(userId, filter);
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 50));
    if (scope.ownerOrgIds.length === 0) {
      return {
        data: [],
        meta: { page, pageSize, total: 0, totalPages: 0 },
      };
    }
    const where = this.rangeWhere(scope, filter);
    const total = await this.prisma.ledgerEntry.count({ where });
    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        mandateId: r.mandateId,
        type: r.type,
        amount: r.amount.toString(),
        currency: r.currency,
        label: r.label,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        occurredAt: r.occurredAt.toISOString(),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /** GET accounting/owner/statements — stored statements (US 13). */
  async listStatements(userId: string): Promise<Array<Record<string, unknown>>> {
    const orgIds = await this.ownerOrgIds(userId);
    if (orgIds.length === 0) return [];
    const rows = await this.prisma.ownerStatement.findMany({
      where: { ownerOrgId: { in: orgIds } },
      orderBy: { periodStart: 'desc' },
      take: 100,
    });
    return Promise.all(
      rows.map(async (s) => ({
        id: s.id,
        mandateId: s.mandateId,
        ownerOrgId: s.ownerOrgId,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        totals: s.totals,
        generatedAt: s.generatedAt.toISOString(),
        url: await this.safePresign(s.fileKey),
      })),
    );
  }

  /**
   * POST accounting/owner/statements — generate a statement PDF for a
   * period; totals come straight from the ledger so the displayed net and
   * the entry sum always match (spec 03 acceptance).
   */
  async generateStatement(
    userId: string,
    input: { mandateId?: string; periodStart: Date; periodEnd: Date },
  ): Promise<Record<string, unknown>> {
    if (input.periodEnd <= input.periodStart) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'periodEnd must be after periodStart',
      });
    }
    const scope = await this.ownerScope(userId, {});
    if (scope.ownerOrgIds.length === 0) {
      throw new NotFoundException({
        code: 'NO_OWNER_ORG',
        message: 'No owner organization found for this user',
      });
    }

    const where: Prisma.LedgerEntryWhereInput = {
      ownerOrgId: { in: scope.ownerOrgIds },
      occurredAt: { gte: input.periodStart, lt: input.periodEnd },
      ...(input.mandateId ? { mandateId: input.mandateId } : {}),
    };
    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
    });

    const totals: Record<string, Prisma.Decimal> = {};
    let net = new Prisma.Decimal(0);
    for (const e of entries) {
      const current = totals[e.type] ?? new Prisma.Decimal(0);
      totals[e.type] = current.add(e.amount);
      net = net.add(e.amount);
    }
    const totalsJson = {
      ...Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [k, v.toString()]),
      ),
      net: net.toString(),
      count: entries.length,
    };

    const mandateLabel = input.mandateId
      ? (
          await this.prisma.mandate
            .findUnique({ where: { id: input.mandateId } })
            .catch(() => null)
        )?.id ?? input.mandateId
      : undefined;

    const pdf = await renderStatementPdf({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      label: mandateLabel,
      totals: totalsJson,
      entries: entries.slice(0, 100).map((e) => ({
        date: e.occurredAt,
        type: e.type,
        label: e.label,
        amount: e.amount.toString(),
        currency: e.currency,
      })),
    });
    const uploaded = await this.r2.uploadPrivateFile({
      folder: 'statements',
      ownerId: userId,
      filename: `releve-${input.periodStart.toISOString().slice(0, 10)}.pdf`,
      contentType: 'application/pdf',
      body: pdf,
    });

    const ownerOrgId =
      (await this.prisma.property.findFirst({
        where: { ownerId: userId },
        select: { organizationId: true },
      }))?.organizationId ?? scope.ownerOrgIds[0];

    const row = await this.prisma.ownerStatement.create({
      data: {
        mandateId: input.mandateId ?? null,
        ownerOrgId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totals: totalsJson as Prisma.InputJsonValue,
        fileKey: uploaded.key,
      },
    });

    return {
      id: row.id,
      mandateId: row.mandateId,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      totals: totalsJson,
      generatedAt: row.generatedAt.toISOString(),
      url: await this.safePresign(row.fileKey),
    };
  }

  /** GET accounting/agency/fees — fee turnover per mandate/period (US 15). */
  async agencyFees(
    userId: string,
    filter: RangeFilter,
  ): Promise<{
    data: Array<{
      mandateId: string | null;
      propertyId: string;
      totalFee: string;
      entryCount: number;
    }>;
    total: string;
  }> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, role: OrgMemberRole.ADMIN },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    if (orgIds.length === 0) return { data: [], total: '0' };

    const where: Prisma.LedgerEntryWhereInput = {
      type: 'FEE',
      agencyOrgId: { in: orgIds },
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
    };

    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['mandateId', 'propertyId'],
      where,
      _sum: { amount: true },
      _count: { amount: true },
    });
    let total = new Prisma.Decimal(0);
    const data = grouped.map((g) => {
      const sum = g._sum.amount ?? new Prisma.Decimal(0);
      total = total.add(sum);
      return {
        mandateId: g.mandateId,
        propertyId: g.propertyId,
        // FEE rows are negative: expose the magnitude as turnover.
        totalFee: sum.abs().toString(),
        entryCount: g._count.amount,
      };
    });
    return { data, total: total.abs().toString() };
  }

  /** GET accounting/export.csv — raw ledger export (spec 03 P2). */
  async exportCsv(
    userId: string,
    filter: RangeFilter,
  ): Promise<string> {
    const isOwner = (await this.ownerOrgIds(userId)).length > 0;
    const isManager =
      (await this.prisma.organizationMember.count({
        where: { userId, role: OrgMemberRole.ADMIN },
      })) > 0;
    if (!isOwner && !isManager) {
      throw new BadRequestException({
        code: 'NOT_EXPORT_ALLOWED',
        message: 'Only an owner or an agency gérant can export the ledger',
      });
    }

    const where: Prisma.LedgerEntryWhereInput = isOwner
      ? this.rangeWhere(await this.ownerScope(userId, filter), filter)
      : {
          agencyOrgId: {
            in: (
              await this.prisma.organizationMember.findMany({
                where: { userId, role: OrgMemberRole.ADMIN },
                select: { organizationId: true },
              })
            ).map((m) => m.organizationId),
          },
          ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
          ...(filter.from || filter.to
            ? {
                occurredAt: {
                  ...(filter.from ? { gte: filter.from } : {}),
                  ...(filter.to ? { lte: filter.to } : {}),
                },
              }
            : {}),
        };

    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: { occurredAt: 'asc' },
      take: 5000,
    });
    const header = [
      'id',
      'date',
      'type',
      'label',
      'amount',
      'currency',
      'propertyId',
      'mandateId',
      'sourceType',
      'sourceId',
    ];
    const lines = rows.map((r) =>
      [
        r.id,
        r.occurredAt.toISOString(),
        r.type,
        csvCell(r.label),
        r.amount.toString(),
        r.currency,
        r.propertyId,
        r.mandateId ?? '',
        r.sourceType,
        r.sourceId,
      ].join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async ownerOrgIds(userId: string): Promise<string[]> {
    const props = await this.prisma.property.findMany({
      where: { ownerId: userId },
      select: { organizationId: true },
      distinct: ['organizationId'],
      take: 500,
    });
    return [...new Set(props.map((p) => p.organizationId))];
  }

  private async ownerScope(
    userId: string,
    filter: RangeFilter,
  ): Promise<LedgerScope> {
    const ownerOrgIds = await this.ownerOrgIds(userId);
    if (!filter.propertyId) return { ownerOrgIds };
    const property = await this.prisma.property.findUnique({
      where: { id: filter.propertyId },
      select: { ownerId: true },
    });
    if (property?.ownerId !== userId) {
      throw new BadRequestException({
        code: 'NOT_PROPERTY_OWNER',
        message: 'You can only query your own properties',
      });
    }
    return { ownerOrgIds, propertyIds: [filter.propertyId] };
  }

  private rangeWhere(scope: LedgerScope, filter: RangeFilter) {
    return {
      ownerOrgId: { in: scope.ownerOrgIds },
      ...(scope.propertyIds ? { propertyId: { in: scope.propertyIds } } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    } satisfies Prisma.LedgerEntryWhereInput;
  }

  private async safePresign(key: string): Promise<string | null> {
    try {
      return await this.r2.createPresignedDownload(key);
    } catch {
      return null;
    }
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
