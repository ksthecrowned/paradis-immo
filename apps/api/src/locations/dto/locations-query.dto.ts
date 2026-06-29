import { IsOptional, IsString } from 'class-validator';

export class CitiesQueryDto {
  @IsOptional()
  @IsString()
  countryCode?: string;
}

export class ArrondissementsQueryDto {
  @IsString()
  cityId!: string;
}

export class QuartiersQueryDto {
  @IsString()
  arrondissementId!: string;
}
