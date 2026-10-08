import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Spec 04 — a deduction proposed by the manager on the exit inspection
 * (line, amount, evidence).
 */
export class CreateDeductionDto {
  /** What was deducted: "Rayures sur la porte", "Carrelage cassé"… */
  @IsString()
  @Length(2, 200)
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  /** `InspectionItem` backing the deduction (exit EDL), when there is one. */
  @IsOptional()
  @IsString()
  evidenceItemId?: string;

  /** Photos of the EDL item; 20 per room is the inspection ceiling. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  evidenceKeys?: string[];
}
