import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class ArrearsQueryDto {
  @IsOptional()
  @IsString()
  propertyId?: string;

  /** 0-30 days, 31-60 days or 60+ days of arrears. */
  @IsOptional()
  @IsIn(['0-30', '31-60', '60+'])
  bucket?: string;

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

/** Spec 04 — manual dunning message (US 20). */
export class SendReminderDto {
  /** Defaults to the tenant's channel; WhatsApp when unset. */
  @IsOptional()
  @IsIn(['WHATSAPP', 'PUSH'])
  channel?: 'WHATSAPP' | 'PUSH';

  /** Free-form wording; a standard message is used when omitted. */
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  message?: string;
}
