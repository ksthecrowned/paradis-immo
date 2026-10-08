import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DepositDeductionStatus } from '@prisma/client';

/**
 * Spec 04 — the tenant contests a proposed deduction within 15 days; the
 * manager accepts it (or overrides a contestation) when settling.
 */
export class UpdateDeductionDto {
  @IsEnum(DepositDeductionStatus)
  status!: DepositDeductionStatus;

  /** Required in practice to contest: shown to the manager. */
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  tenantComment?: string;
}

/** Manager decisions on a deduction. */
export class DecideDeductionDto {
  @IsEnum(DepositDeductionStatus)
  @IsOptional()
  status?: DepositDeductionStatus;
}
