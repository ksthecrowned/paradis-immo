import { Injectable, Logger } from '@nestjs/common';
import { VisitSlot, VisitSlotSource, VisitSlotStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface TemplateInput {
  id: string;
  propertyId: string;
  dayOfWeek: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotMinutes: number;
  active: boolean;
  createdAt: Date;
}

/**
 * Pure function: turn a set of templates + a horizon (days) into a list of
 * concrete slot records. No DB access — testable in isolation.
 *
 * Algorithm:
 *   1. Walk `now` to `now + horizonDays`, day by day.
 *   2. For each day, find templates matching `dayOfWeek`.
 *   3. For each matching template, split [startTime, endTime) into
 *      `slotMinutes`-wide chunks. Drop chunks that would exceed endTime.
 *
 * The `now` parameter is mandatory so the function is deterministic in tests.
 */
export function generateSlotsForProperty(
  templates: TemplateInput[],
  horizonDays: number,
  now: Date,
): Array<{ startAt: Date; endAt: Date; source: VisitSlotSource }> {
  const slots: Array<{ startAt: Date; endAt: Date; source: VisitSlotSource }> =
    [];

  for (let d = 0; d < horizonDays; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    const dow = day.getUTCDay();
    const matching = templates.filter((t) => t.active && t.dayOfWeek === dow);
    if (matching.length === 0) continue;

    for (const tpl of matching) {
      const [sh, sm] = tpl.startTime.split(':').map(Number);
      const [eh, em] = tpl.endTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (endMin <= startMin) continue;
      if (tpl.slotMinutes <= 0) continue;

      for (
        let m = startMin;
        m + tpl.slotMinutes <= endMin;
        m += tpl.slotMinutes
      ) {
        const startAt = new Date(day);
        startAt.setUTCHours(Math.floor(m / 60), m % 60, 0, 0);
        const endAt = new Date(startAt.getTime() + tpl.slotMinutes * 60 * 1000);
        slots.push({ startAt, endAt, source: VisitSlotSource.TEMPLATE });
      }
    }
  }

  return slots;
}

/**
 * Database-backed service that owns the `VisitSlot` lifecycle. Wraps the pure
 * `generateSlotsForProperty` function and persists results idempotently.
 *
 * The `@skipDuplicates: true` mode on `createMany` plus the
 * `@@unique([propertyId, startAt])` index make regenerations safe to retry
 * (e.g. if the weekly cron runs twice).
 */
@Injectable()
export class VisitSlotGenerator {
  private readonly logger = new Logger(VisitSlotGenerator.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate `VisitSlot` rows for a single property covering the next
   * `horizonDays` days. Returns the slots actually inserted (skipping
   * any that already exist).
   */
  async generateForProperty(
    propertyId: string,
    horizonDays = 14,
    now: Date = new Date(),
  ): Promise<VisitSlot[]> {
    const templates = await this.prisma.visitSlotTemplate.findMany({
      where: { propertyId, active: true },
    });

    const planned = generateSlotsForProperty(
      templates.map((t) => ({
        id: t.id,
        propertyId: t.propertyId,
        dayOfWeek: t.dayOfWeek,
        startTime: t.startTime,
        endTime: t.endTime,
        slotMinutes: t.slotMinutes,
        active: t.active,
        createdAt: t.createdAt,
      })),
      horizonDays,
      now,
    );

    if (planned.length === 0) return [];

    // `skipDuplicates` requires casting because Prisma's typed `createMany`
    // does not know about the unique index on (propertyId, startAt).
    const created = await this.prisma.visitSlot.createMany({
      data: planned.map((p) => ({
        propertyId,
        startAt: p.startAt,
        endAt: p.endAt,
        status: VisitSlotStatus.AVAILABLE,
        source: p.source,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Generated ${created.count} slot(s) for property ${propertyId} (${horizonDays}d horizon)`,
    );

    // Return the rows that actually exist (covers both fresh and idempotent runs).
    return this.prisma.visitSlot.findMany({
      where: {
        propertyId,
        startAt: {
          gte: planned[0].startAt,
          lte: planned[planned.length - 1].startAt,
        },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Weekly cron entry point. Generates slots for every property that has at
   * least one active template.
   */
  async generateForAllProperties(
    horizonDays = 14,
  ): Promise<{ properties: number; slots: number }> {
    const properties = await this.prisma.property.findMany({
      where: { visitTemplates: { some: { active: true } } },
      select: { id: true },
    });
    let totalSlots = 0;
    for (const p of properties) {
      const rows = await this.generateForProperty(p.id, horizonDays);
      totalSlots += rows.length;
    }
    return { properties: properties.length, slots: totalSlots };
  }
}
