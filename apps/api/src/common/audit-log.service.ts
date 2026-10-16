import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  actorType?: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Spec 15 A3 — audit log append-only pour les actions sensibles (spec 12).
 *
 * Écritures : jamais modifiées ni supprimées. `record()` ne lève pas en cas
 * d'échec : l'action métier doit réussir même si l'audit échoue (erreur
 * journalisée à la place). `recordIn()` est la variante transactionnelle
 * pour les actions critiques déroulées dans une `$transaction`.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorType: entry.actorType ?? 'ADMIN',
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          before: (entry.before ?? undefined) as Prisma.InputJsonValue,
          after: (entry.after ?? undefined) as Prisma.InputJsonValue,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `AuditLog write failed for ${entry.action} ${entry.targetType}/${entry.targetId}: ${String(err)}`,
      );
    }
  }

  async recordIn(
    tx: Prisma.TransactionClient,
    entry: AuditEntry,
  ): Promise<void> {
    // Dans une transaction, un échec d'audit est bloquant : mieux vaut
    // avorter l'action que livrer une écriture sensible non auditée.
    await tx.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? 'ADMIN',
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  async list(filter: {
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
    const limit = Math.min(filter.limit ?? 50, 200);
    const offset = filter.offset ?? 0;
    const where = {
      ...(filter.actorId ? { actorId: filter.actorId } : {}),
      ...(filter.action ? { action: { contains: filter.action } } : {}),
      ...(filter.targetType ? { targetType: filter.targetType } : {}),
      ...(filter.targetId ? { targetId: filter.targetId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorType: r.actorType,
        impersonatedBy: r.impersonatedBy,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        before: r.before,
        after: r.after,
        metadata: r.metadata,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }
}
