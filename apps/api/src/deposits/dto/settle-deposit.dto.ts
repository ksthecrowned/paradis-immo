import { IsIn, IsOptional, IsString, Length } from 'class-validator';

/**
 * Spec 04 — closing the deposit: refund = deposit − ACCEPTED deductions.
 * The payout itself is executed by the payments spec (05); the method is
 * recorded here so the cash desk knows how to hand the money back.
 */
export class SettleDepositDto {
  /** Defaults to the country currency (XAF). */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** CASH (validated by an agent) or BANK_TRANSFER. */
  @IsOptional()
  @IsIn(['CASH', 'BANK_TRANSFER'])
  method?: 'CASH' | 'BANK_TRANSFER';

  /** Free-form note printed on the restitution receipt. */
  @IsOptional()
  @IsString()
  @Length(3, 500)
  note?: string;
}
