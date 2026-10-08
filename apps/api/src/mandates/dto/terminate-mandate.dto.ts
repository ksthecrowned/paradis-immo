import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /mandates/:id/decline — agency gérant declines with a reason. */
export class DeclineMandateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

/** POST /mandates/:id/terminate — notice period, or immediate for cause. */
export class TerminateMandateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @IsOptional() @IsBoolean() immediate?: boolean;
}
