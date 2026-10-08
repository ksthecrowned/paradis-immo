import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Spec 04 US 20 — mise en demeure. */
export class FormalNoticeDto {
  /**
   * Delay granted to the tenant by the letter. Defaults to 15 days, the
   * grace period used by the spec.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  paymentDelayDays?: number;
}
