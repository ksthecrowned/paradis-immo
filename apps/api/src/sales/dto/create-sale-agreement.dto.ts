import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleInstallmentInputDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  label?: string;

  @Type(() => Date)
  @IsDate()
  dueDate!: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateSaleAgreementDto {
  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  buyerPhone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  buyerName?: string;

  @IsOptional()
  @IsString()
  saleInquiryId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedPrice!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleInstallmentInputDto)
  installments!: SaleInstallmentInputDto[];
}

export class UpdateSaleAgreementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedPrice?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleInstallmentInputDto)
  installments?: SaleInstallmentInputDto[];
}
