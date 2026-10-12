import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';

const Decimal = Prisma.Decimal;

/**
 * Spec 07 — paramètres de séjour et tarifs saisonniers par bien.
 * Écriture réservée au gestionnaire (owner, gérant d'agence ou agent
 * assigné via mandat actif) : `AgencyAccessService.assertCanOperateOnProperty`.
 */
@Injectable()
export class StaySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async getSettings(userId: string, propertyId: string) {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const settings = await this.prisma.stayListingSettings.findUnique({
      where: { propertyId },
    });
    if (!settings) {
      throw new NotFoundException({
        code: 'STAY_SETTINGS_MISSING',
        message:
          'Les paramètres de séjour ne sont pas configurés pour ce bien.',
      });
    }
    return this.toPublicSettings(settings);
  }

  /** PUT — crée ou met à jour (upsert) les paramètres du séjour. */
  async upsertSettings(
    userId: string,
    propertyId: string,
    input: Record<string, unknown>,
  ) {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    await this.assertPropertyIsStay(propertyId);

    const data: Prisma.StayListingSettingsUncheckedUpdateInput = {};
    const num = (v: unknown) => new Decimal(v as Prisma.Decimal.Value);

    if (input.baseNightlyRate !== undefined)
      data.baseNightlyRate = num(input.baseNightlyRate);
    if (input.weekendNightlyRate !== undefined)
      data.weekendNightlyRate =
        input.weekendNightlyRate === null ? null : num(input.weekendNightlyRate);
    if (input.weeklyDiscount !== undefined)
      data.weeklyDiscount =
        input.weeklyDiscount === null ? null : num(input.weeklyDiscount);
    if (input.monthlyDiscount !== undefined)
      data.monthlyDiscount =
        input.monthlyDiscount === null ? null : num(input.monthlyDiscount);
    if (input.cleaningFee !== undefined) data.cleaningFee = num(input.cleaningFee);
    if (input.baseGuests !== undefined) data.baseGuests = input.baseGuests as number;
    if (input.maxGuests !== undefined) data.maxGuests = input.maxGuests as number;
    if (input.extraGuestFee !== undefined)
      data.extraGuestFee = num(input.extraGuestFee);
    if (input.minNights !== undefined) data.minNights = input.minNights as number;
    if (input.maxNights !== undefined) data.maxNights = input.maxNights as number;
    if (input.advanceNoticeHours !== undefined)
      data.advanceNoticeHours = input.advanceNoticeHours as number;
    if (input.bookingWindowDays !== undefined)
      data.bookingWindowDays = input.bookingWindowDays as number;
    if (input.instantBook !== undefined)
      data.instantBook = input.instantBook as boolean;
    if (input.cancellationPolicy !== undefined)
      data.cancellationPolicy = input.cancellationPolicy as string;
    if (input.depositMode !== undefined)
      data.depositMode = input.depositMode as string;
    if (input.depositAmount !== undefined)
      data.depositAmount = num(input.depositAmount);
    if (input.checkInFrom !== undefined)
      data.checkInFrom = input.checkInFrom as string;
    if (input.checkOutBefore !== undefined)
      data.checkOutBefore = input.checkOutBefore as string;
    if (input.houseRules !== undefined)
      data.houseRules = (input.houseRules as string | null) ?? null;
    if (input.arrivalInstructions !== undefined)
      data.arrivalInstructions = (input.arrivalInstructions as string | null) ?? null;
    if (input.serviceFeeRate !== undefined)
      data.serviceFeeRate = num(input.serviceFeeRate);

    const baseGuests = data.baseGuests ?? undefined;
    const maxGuests = data.maxGuests ?? undefined;
    if (
      baseGuests !== undefined &&
      maxGuests !== undefined &&
      baseGuests > maxGuests
    ) {
      throw new BadRequestException({
        code: 'INVALID_GUESTS_RANGE',
        message: 'baseGuests doit être ≤ maxGuests',
      });
    }

    // Prisma exige les champs requis dans la branche create même quand le
    // row existe : on complète avec les valeurs existantes ou des défauts
    // sensibles (baseNightlyRate obligatoire à la création).
    const createData = {
      baseNightlyRate: 0,
      cleaningFee: 0,
      extraGuestFee: 0,
      depositAmount: 0,
      serviceFeeRate: 0.07,
      propertyId,
      ...data,
    } as unknown as Prisma.StayListingSettingsUncheckedCreateInput;
    const settings = await this.prisma.stayListingSettings.upsert({
      where: { propertyId },
      create: createData,
      update: data,
    });
    return this.toPublicSettings(settings);
  }

  async listSeasonalRates(userId: string, propertyId: string) {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const rates = await this.prisma.seasonalRate.findMany({
      where: { propertyId },
      orderBy: { startDate: 'asc' },
    });
    return rates.map((r) => this.toPublicRate(r));
  }

  async createSeasonalRate(
    userId: string,
    propertyId: string,
    input: {
      startDate: Date;
      endDate: Date;
      nightlyRate: number | string;
      minNights?: number;
      label?: string;
    },
  ) {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    if (input.endDate <= input.startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'endDate must be after startDate',
      });
    }
    // Chevauchement interdit entre tarifs saisonniers d'un même bien.
    const overlap = await this.prisma.seasonalRate.findFirst({
      where: {
        propertyId,
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException({
        code: 'SEASONAL_RATE_OVERLAP',
        message: 'Un tarif saisonnier couvre déjà ces dates',
      });
    }
    const rate = await this.prisma.seasonalRate.create({
      data: {
        propertyId,
        startDate: input.startDate,
        endDate: input.endDate,
        nightlyRate: new Decimal(input.nightlyRate),
        ...(input.minNights !== undefined ? { minNights: input.minNights } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      },
    });
    return this.toPublicRate(rate);
  }

  async updateSeasonalRate(
    userId: string,
    propertyId: string,
    rateId: string,
    input: {
      startDate?: Date;
      endDate?: Date;
      nightlyRate?: number | string;
      minNights?: number | null;
      label?: string | null;
    },
  ) {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const existing = await this.prisma.seasonalRate.findUnique({
      where: { id: rateId },
    });
    if (!existing || existing.propertyId !== propertyId) {
      throw new NotFoundException({
        code: 'SEASONAL_RATE_NOT_FOUND',
        message: 'Tarif saisonnier introuvable',
      });
    }
    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    if (endDate <= startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'endDate must be after startDate',
      });
    }
    const overlap = await this.prisma.seasonalRate.findFirst({
      where: {
        propertyId,
        id: { not: rateId },
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException({
        code: 'SEASONAL_RATE_OVERLAP',
        message: 'Un tarif saisonnier couvre déjà ces dates',
      });
    }
    const rate = await this.prisma.seasonalRate.update({
      where: { id: rateId },
      data: {
        startDate,
        endDate,
        ...(input.nightlyRate !== undefined
          ? { nightlyRate: new Decimal(input.nightlyRate) }
          : {}),
        ...(input.minNights !== undefined ? { minNights: input.minNights } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
      },
    });
    return this.toPublicRate(rate);
  }

  async deleteSeasonalRate(
    userId: string,
    propertyId: string,
    rateId: string,
  ): Promise<void> {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const existing = await this.prisma.seasonalRate.findUnique({
      where: { id: rateId },
      select: { id: true, propertyId: true },
    });
    if (!existing || existing.propertyId !== propertyId) {
      throw new NotFoundException({
        code: 'SEASONAL_RATE_NOT_FOUND',
        message: 'Tarif saisonnier introuvable',
      });
    }
    await this.prisma.seasonalRate.delete({ where: { id: rateId } });
  }

  private async assertPropertyIsStay(propertyId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { mode: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.mode !== 'RENT_SHORT') {
      throw new BadRequestException({
        code: 'STAY_MODE_NOT_ALLOWED',
        message: 'Les paramètres de séjour ne concernent que les biens RENT_SHORT',
      });
    }
  }

  private toPublicSettings(s: {
    propertyId: string;
    baseNightlyRate: Prisma.Decimal;
    weekendNightlyRate: Prisma.Decimal | null;
    weeklyDiscount: Prisma.Decimal | null;
    monthlyDiscount: Prisma.Decimal | null;
    cleaningFee: Prisma.Decimal;
    baseGuests: number;
    maxGuests: number;
    extraGuestFee: Prisma.Decimal;
    minNights: number;
    maxNights: number;
    advanceNoticeHours: number;
    bookingWindowDays: number;
    instantBook: boolean;
    cancellationPolicy: string;
    depositMode: string;
    depositAmount: Prisma.Decimal;
    checkInFrom: string;
    checkOutBefore: string;
    houseRules: string | null;
    arrivalInstructions: string | null;
    serviceFeeRate: Prisma.Decimal;
  }) {
    return {
      propertyId: s.propertyId,
      baseNightlyRate: s.baseNightlyRate.toString(),
      weekendNightlyRate: s.weekendNightlyRate?.toString() ?? null,
      weeklyDiscount: s.weeklyDiscount?.toString() ?? null,
      monthlyDiscount: s.monthlyDiscount?.toString() ?? null,
      cleaningFee: s.cleaningFee.toString(),
      baseGuests: s.baseGuests,
      maxGuests: s.maxGuests,
      extraGuestFee: s.extraGuestFee.toString(),
      minNights: s.minNights,
      maxNights: s.maxNights,
      advanceNoticeHours: s.advanceNoticeHours,
      bookingWindowDays: s.bookingWindowDays,
      instantBook: s.instantBook,
      cancellationPolicy: s.cancellationPolicy,
      depositMode: s.depositMode,
      depositAmount: s.depositAmount.toString(),
      checkInFrom: s.checkInFrom,
      checkOutBefore: s.checkOutBefore,
      houseRules: s.houseRules,
      arrivalInstructions: s.arrivalInstructions,
      serviceFeeRate: s.serviceFeeRate.toString(),
    };
  }

  private toPublicRate(r: {
    id: string;
    propertyId: string;
    startDate: Date;
    endDate: Date;
    nightlyRate: Prisma.Decimal;
    minNights: number | null;
    label: string | null;
  }) {
    return {
      id: r.id,
      propertyId: r.propertyId,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      nightlyRate: r.nightlyRate.toString(),
      minNights: r.minNights,
      label: r.label,
    };
  }
}
