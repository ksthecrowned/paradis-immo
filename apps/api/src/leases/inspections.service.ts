import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Inspection,
  InspectionType,
  ItemCondition,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';

/**
 * Spec 15 B1 (spec 04) — états des lieux d'entrée et de sortie.
 *
 * Règles clés :
 * - un seul EDL par (bail, type) — `@@unique([leaseId, type])` ;
 * - l'EDL est un brouillon modifiable tant que les deux signatures (tenant
 *   et gestionnaire) ne sont pas posées ; après double signature il devient
 *   immuable (409 `INSPECTION_SIGNED`) ;
 * - le locataire peut ajouter des réserves jusqu'à `reservesUntil` (J+10
 *   après signature gestionnaire par défaut) ;
 * - `compare` compare entrée/sortie : les éléments dégradés en sortie
 *   (condition strictement pire qu'en entrée) deviennent des écarts.
 */
type RoomPayload = {
  name: string;
  items: Array<{
    label: string;
    condition: ItemCondition;
    comment?: string;
    photoKeys?: string[];
  }>;
};

export interface UpdateInspectionPayload {
  generalComment?: string;
  meters?: { water?: string; electricity?: string };
  keys?: Array<{ label: string; count: number }>;
  rooms?: RoomPayload[];
}

export interface InspectionPublic {
  id: string;
  leaseId: string;
  type: InspectionType;
  performedById: string;
  performedAt: string;
  meters: { water?: string; electricity?: string } | null;
  keys: Array<{ label: string; count: number }> | null;
  generalComment: string | null;
  managerSignedAt: string | null;
  tenantSignedAt: string | null;
  reservesUntil: string | null;
  rooms: Array<{
    id: string;
    name: string;
    position: number;
    items: Array<{
      id: string;
      label: string;
      condition: ItemCondition;
      comment: string | null;
      photoKeys: string[];
    }>;
  }>;
  reserves: Array<{ id: string; authorId: string; text: string; photoKeys: string[]; createdAt: string }>;
}

const RESERVES_WINDOW_DAYS = 10;

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async create(
    userId: string,
    leaseId: string,
    type: InspectionType,
  ): Promise<InspectionPublic> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { id: true, propertyId: true, tenantId: true, status: true },
    });
    if (!lease) {
      throw new BadRequestException({
        code: 'LEASE_NOT_FOUND',
        message: "Le bail n'existe pas",
      });
    }
    const isTenant = lease.tenantId === userId;
    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        lease.propertyId,
      );
    }
    const existing = await this.prisma.inspection.findUnique({
      where: { leaseId_type: { leaseId, type } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'INSPECTION_ALREADY_EXISTS',
        message: `Un EDL de type ${type} existe déjà pour ce bail`,
      });
    }
    // CHECK_OUT n'est créable que sur un bail en cours de finition
    // (TERMINATING/ACTIVE proche de la fin) — règle douce : bail pas DRAFT.
    if (type === InspectionType.CHECK_OUT && lease.status === 'DRAFT') {
      throw new ConflictException({
        code: 'LEASE_NOT_ELIGIBLE',
        message: "L'EDL de sortie exige un bail actif ou en fin de bail",
      });
    }

    const created = await this.prisma.inspection.create({
      data: { leaseId, type, performedById: userId, performedAt: new Date() },
      include: { rooms: { include: { items: true } }, reserves: true },
    });
    return this.toPublic(created);
  }

  /** Brouillon : remplace rooms/items + compteurs + clés. 409 si signé. */
  async update(
    userId: string,
    inspectionId: string,
    payload: UpdateInspectionPayload,
  ): Promise<InspectionPublic> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { lease: { select: { propertyId: true, tenantId: true } } },
    });
    if (!inspection) {
      throw new BadRequestException({
        code: 'INSPECTION_NOT_FOUND',
        message: "L'EDL n'existe pas",
      });
    }
    const isTenant = inspection.lease.tenantId === userId;
    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        inspection.lease.propertyId,
      );
    }
    if (inspection.managerSignedAt && inspection.tenantSignedAt) {
      throw new ConflictException({
        code: 'INSPECTION_SIGNED',
        message:
          "L'EDL est signé par les deux parties et ne peut plus être modifié",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (payload.rooms) {
        // Remplacement complet des pièces (brouillon) — cascade.
        await tx.inspectionRoom.deleteMany({
          where: { inspectionId },
        });
        for (const [index, room] of payload.rooms.entries()) {
          await tx.inspectionRoom.create({
            data: {
              inspectionId,
              name: room.name,
              position: index,
              items: {
                create: room.items.map((item) => ({
                  label: item.label,
                  condition: item.condition,
                  comment: item.comment ?? null,
                  photoKeys: item.photoKeys ?? [],
                })),
              },
            },
          });
        }
      }
      return tx.inspection.update({
        where: { id: inspectionId },
        data: {
          ...(payload.generalComment !== undefined
            ? { generalComment: payload.generalComment }
            : {}),
          ...(payload.meters
            ? { meters: payload.meters as Prisma.InputJsonValue }
            : {}),
          ...(payload.keys
            ? { keys: payload.keys as Prisma.InputJsonValue }
            : {}),
        },
        include: { rooms: { include: { items: true } }, reserves: true },
      });
    });
    return this.toPublic(updated);
  }

  /** Signature d'une partie. Le locataire et le gestionnaire signent. */
  async sign(
    userId: string,
    inspectionId: string,
    asTenant: boolean,
  ): Promise<InspectionPublic> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { lease: { select: { propertyId: true, tenantId: true } } },
    });
    if (!inspection) {
      throw new BadRequestException({
        code: 'INSPECTION_NOT_FOUND',
        message: "L'EDL n'existe pas",
      });
    }
    if (asTenant) {
      if (inspection.lease.tenantId !== userId) {
        throw new ForbiddenException({
          code: 'NOT_LEASE_TENANT',
          message: "Seul le locataire peut signer en tant que locataire",
        });
      }
      if (inspection.tenantSignedAt) return this.getOnePublic(inspectionId);
    } else {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        inspection.lease.propertyId,
      );
      if (inspection.managerSignedAt) return this.getOnePublic(inspectionId);
    }

    const updated = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data: asTenant
        ? { tenantSignedAt: new Date() }
        : {
            managerSignedAt: new Date(),
            reservesUntil: new Date(
              Date.now() + RESERVES_WINDOW_DAYS * 86_400_000,
            ),
          },
      include: { rooms: { include: { items: true } }, reserves: true },
    });
    return this.toPublic(updated);
  }

  async addReserve(
    userId: string,
    inspectionId: string,
    text: string,
    photoKeys: string[],
  ): Promise<InspectionPublic> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { lease: { select: { propertyId: true, tenantId: true } } },
    });
    if (!inspection) {
      throw new BadRequestException({
        code: 'INSPECTION_NOT_FOUND',
        message: "L'EDL n'existe pas",
      });
    }
    if (
      inspection.lease.tenantId !== userId &&
      !(await this.agencyAccess.canOperateOnProperty(
        userId,
        inspection.lease.propertyId,
      ))
    ) {
      // ok: la réserves est un droit locataire principal (les gestionnaires
      // peuvent aussi en ajouter, mais pas un tiers).
      throw new ForbiddenException({
        code: 'NOT_INSPECTION_PARTY',
        message: 'Seul le locataire peut ajouter des réserves',
      });
    }
    if (!inspection.reservesUntil) {
      throw new ConflictException({
        code: 'RESERVES_NOT_OPEN',
        message:
          "Les réserves s'ouvrent après la signature du gestionnaire",
      });
    }
    if (Date.now() > inspection.reservesUntil.getTime()) {
      throw new ConflictException({
        code: 'RESERVES_EXPIRED',
        message: "La fenêtre de réserves est passée (10 jours)",
      });
    }
    await this.prisma.inspectionReserve.create({
      data: { inspectionId, authorId: userId, text, photoKeys },
    });
    return this.getOnePublic(inspectionId);
  }

  /**
   * Comparatif entrée/sortie : items avec condition de sortie strictement
   * pire (GOOD<NEW…) → écarts proposés comme retenues de caution.
   */
  async compare(
    userId: string,
    leaseId: string,
  ): Promise<{
    tally: Array<{
      roomName: string;
      label: string;
      conditionIn: ItemCondition;
      conditionOut: ItemCondition;
      commentOut: string | null;
    }>;
    total: number;
  }> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { propertyId: true, tenantId: true },
    });
    if (!lease) {
      throw new BadRequestException({
        code: 'LEASE_NOT_FOUND',
        message: "Le bail n'existe pas",
      });
    }
    const isTenant = lease.tenantId === userId;
    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        lease.propertyId,
      );
    }
    const conditionLadder = [
      ItemCondition.NEW,
      ItemCondition.GOOD,
      ItemCondition.WORN,
      ItemCondition.DAMAGED,
      ItemCondition.MISSING,
    ];
    const rank = (c: ItemCondition): number => conditionLadder.indexOf(c);

    const [cin, cout] = await Promise.all([
      this.prisma.inspection.findUnique({
        where: { leaseId_type: { leaseId, type: InspectionType.CHECK_IN } },
        include: { rooms: { include: { items: true } } },
      }),
      this.prisma.inspection.findUnique({
        where: { leaseId_type: { leaseId, type: InspectionType.CHECK_OUT } },
        include: { rooms: { include: { items: true } } },
      }),
    ]);
    if (!cin || !cout) {
      throw new ConflictException({
        code: 'BOTH_INSPECTIONS_REQUIRED',
        message:
          'Le comparatif exige un EDL CHECK_IN et un EDL CHECK_OUT signés',
      });
    }
    const tally: Array<{
      roomName: string;
      label: string;
      conditionIn: ItemCondition;
      conditionOut: ItemCondition;
      commentOut: string | null;
    }> = [];
    for (const room of cout.rooms) {
      const inRoom = cin.rooms.find(
        (r) => r.name.toLowerCase() === room.name.toLowerCase(),
      );
      if (!inRoom) continue;
      for (const item of room.items) {
        const inItem = inRoom.items.find(
          (i) => i.label.toLowerCase() === item.label.toLowerCase(),
        );
        if (!inItem) continue;
        if (rank(item.condition) > rank(inItem.condition)) {
          tally.push({
            roomName: room.name,
            label: item.label,
            conditionIn: inItem.condition,
            conditionOut: item.condition,
            commentOut: item.comment,
          });
        }
      }
    }
    return { tally, total: tally.length };
  }

  async getOne(
    userId: string,
    inspectionId: string,
  ): Promise<InspectionPublic> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { lease: { select: { propertyId: true, tenantId: true } } },
    });
    if (!inspection) {
      throw new BadRequestException({
        code: 'INSPECTION_NOT_FOUND',
        message: "L'EDL n'existe pas",
      });
    }
    const isTenant = inspection.lease.tenantId === userId;
    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        userId,
        inspection.lease.propertyId,
      );
    }
    return this.getOnePublic(inspectionId);
  }

  private async getOnePublic(
    inspectionId: string,
  ): Promise<InspectionPublic> {
    const row = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { rooms: { include: { items: true } }, reserves: true },
    });
    if (!row) {
      throw new BadRequestException({
        code: 'INSPECTION_NOT_FOUND',
        message: "L'EDL n'existe pas",
      });
    }
    return this.toPublic(row as Inspection & {
      rooms: Array<Prisma.InspectionRoomGetPayload<{ include: { items: true } }>>;
      reserves: Array<Prisma.InspectionReserveGetPayload<{}>>;
    });
  }

  private toPublic(
    row: Inspection & {
      rooms: Array<
        Prisma.InspectionRoomGetPayload<{ include: { items: true } }>
      >;
      reserves: Array<{
        id: string;
        authorId: string;
        text: string;
        photoKeys: string[];
        createdAt: Date;
      }>;
    },
  ): InspectionPublic {
    return {
      id: row.id,
      leaseId: row.leaseId,
      type: row.type,
      performedById: row.performedById,
      performedAt: row.performedAt.toISOString(),
      meters: (row.meters as { water?: string; electricity?: string }) ?? null,
      keys: (row.keys as Array<{ label: string; count: number }>) ?? null,
      generalComment: row.generalComment,
      managerSignedAt: row.managerSignedAt?.toISOString() ?? null,
      tenantSignedAt: row.tenantSignedAt?.toISOString() ?? null,
      reservesUntil: row.reservesUntil?.toISOString() ?? null,
      rooms: row.rooms
        .sort((a, b) => a.position - b.position)
        .map((room) => ({
          id: room.id,
          name: room.name,
          position: room.position,
          items: room.items.map((item) => ({
            id: item.id,
            label: item.label,
            condition: item.condition,
            comment: item.comment,
            photoKeys: item.photoKeys,
          })),
        })),
      reserves: row.reserves.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        text: r.text,
        photoKeys: r.photoKeys,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
