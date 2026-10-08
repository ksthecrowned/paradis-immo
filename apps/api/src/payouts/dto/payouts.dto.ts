import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  PaymentProvider,
  PayoutAccountType,
  PayoutStatus,
} from '@prisma/client';

/** POST payouts/request — reversement à la demande. */
export class RequestPayoutDto {
  /** Compte de reversement à utiliser (sinon le compte vérifié par défaut). */
  @IsOptional()
  @IsString()
  payoutAccountId?: string;
}

/** POST organizations/:id/payout-accounts */
export class CreatePayoutAccountDto {
  @IsEnum(PayoutAccountType)
  type!: PayoutAccountType;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  /** Requis pour un compte mobile money. */
  @IsOptional()
  @IsString()
  phone?: string;

  /** Requis pour un compte bancaire. */
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsString()
  holderName!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/** PATCH organizations/:id/payout-accounts/:accountId */
export class UpdatePayoutAccountDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  holderName?: string;
}

/**
 * POST organizations/:id/payout-accounts/:accountId/verify — sandbox :
 * code `1` (micro-dépôt de 1 XAF) ou `000000` (OTP fournisseur simulé).
 */
export class VerifyPayoutAccountDto {
  @IsString()
  code!: string;
}

/** GET payouts/mine et GET admin/payouts */
export class ListPayoutsQueryDto {
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

/** PATCH organizations/:id/payout-settings */
export class UpdatePayoutSettingsDto {
  @IsOptional()
  @IsEnum(['MONTHLY', 'ON_DEMAND'] as const)
  payoutFrequency?: 'MONTHLY' | 'ON_DEMAND';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPayoutAmount?: number;
}
