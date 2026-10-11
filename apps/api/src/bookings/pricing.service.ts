import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const Decimal = Prisma.Decimal;

export interface PriceBreakdown {
  /** Tarif par nuit (index = numéro de la nuit). */
  nightly: { date: string; rate: string; source: 'SEASONAL' | 'WEEKEND' | 'BASE' }[];
  nights: number;
  subtotal: string;
  weeklyDiscount: string;
  monthlyDiscount: string;
  cleaningFee: string;
  extraGuestFee: string;
  serviceFee: string;
  deposit: string;
  total: string;
}

export interface PricingQuote extends PriceBreakdown {
  currency: string;
  /** Contraintes utilisées (contrôle client). */
  minNights: number;
  maxNights: number;
  maxGuests: number;
  instantBook: boolean;
  cancellationPolicy: string;
  guests: number;
}

const WEEKEND_DOW = [0, 6]; // dimanche et samedi

/**
 * Spec 07 — serveur-only pricing. Hiérarchie : SeasonalRate couvrante >
 * week-end > baseNightlyRate. Réductions 7 nuits (weekly) et 28 nuits
 * (monthly), calculated on the nightly subtotal. Frais : ménage fixe,
 * voyageur additionnel au-delà de baseGuests, serviceFeeRate plateforme.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(
    propertyId: string,
    input: { startDate: Date; endDate: Date; guests: number },
  ): Promise<PricingQuote> {
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

    const seasonal = await this.prisma.seasonalRate.findMany({
      where: {
        propertyId,
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
      orderBy: { startDate: 'asc' },
    });

    const nights: PriceBreakdown['nightly'] = [];
    let subtotal = new Decimal(0);
    const cursor = new Date(input.startDate);
    while (cursor < input.endDate) {
      const seasonalRate = seasonal.find(
        (r) => r.startDate <= cursor && r.endDate > cursor,
      );
      const source = seasonalRate
        ? ('SEASONAL' as const)
        : WEEKEND_DOW.includes(cursor.getUTCDay())
          ? ('WEEKEND' as const)
          : ('BASE' as const);
      const rate = new Decimal(
        seasonalRate?.nightlyRate ??
          (source === 'WEEKEND' && settings.weekendNightlyRate
            ? settings.weekendNightlyRate
            : settings.baseNightlyRate),
      );
      nights.push({
        date: cursor.toISOString().slice(0, 10),
        rate: rate.toString(),
        source,
      });
      subtotal = subtotal.add(rate);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const nightsCount = nights.length;
    let discounts = new Decimal(0);
    let weekly = new Decimal(0);
    let monthly = new Decimal(0);
    if (settings.weeklyDiscount && nightsCount >= 7) {
      weekly = subtotal.mul(settings.weeklyDiscount);
    }
    if (settings.monthlyDiscount && nightsCount >= 28) {
      monthly = subtotal.mul(settings.monthlyDiscount);
    }
    discounts = weekly.add(monthly);

    const extraGuests = Math.max(0, input.guests - settings.baseGuests);
    // Frais voyageur additionnel par nuit au-delà de baseGuests.
    const extraGuestFee = new Decimal(settings.extraGuestFee).mul(
      extraGuests * Math.max(1, nightsCount),
    );

    const cleaningFee = new Decimal(settings.cleaningFee);

    const taxable = subtotal.sub(discounts);
    const serviceFee = taxable.mul(settings.serviceFeeRate);

    const total = taxable
      .add(cleaningFee)
      .add(extraGuestFee)
      .add(serviceFee);

    return {
      currency: 'XAF',
      nightly: nights,
      nights: nightsCount,
      subtotal: subtotal.toString(),
      weeklyDiscount: weekly.toString(),
      monthlyDiscount: monthly.toString(),
      cleaningFee: cleaningFee.toString(),
      extraGuestFee: extraGuestFee.toString(),
      serviceFee: serviceFee.toString(),
      deposit:
        settings.depositMode === 'COLLECT_ON_BOOKING'
          ? settings.depositAmount.toString()
          : '0',
      total: total.toString(),
      minNights: settings.minNights,
      maxNights: settings.maxNights,
      maxGuests: settings.maxGuests,
      instantBook: settings.instantBook,
      cancellationPolicy: settings.cancellationPolicy,
      guests: input.guests,
    };
  }

}
