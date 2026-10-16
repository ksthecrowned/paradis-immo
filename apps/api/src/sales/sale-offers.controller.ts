import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SaleOffersService } from './sale-offers.service';

export class CreateSaleOfferDto {
  @Type(() => Number) @IsNumber() @Min(1) price!: number;
  @IsIn(['CASH', 'INSTALLMENTS', 'BANK_LOAN']) financing:
    'CASH' | 'INSTALLMENTS' | 'BANK_LOAN' = 'CASH';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) depositAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  installmentsCount?: number;
  @IsOptional() @IsString() @MaxLength(500) conditions?: string;
  /** Validité en jours (défaut 7, spec 08). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  validDays?: number;
}

export class CounterOfferDto extends CreateSaleOfferDto {
  @IsOptional() @IsString() note?: string;
}

export class RejectOfferDto {
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** Contre-offre : les deux côtés. */
@ApiTags('Sale offers')
@ApiBearerAuth()
@Controller('properties/:propertyId/offers')
@UseGuards(AppAuthGuard)
export class SaleOffersPropertyController {
  constructor(private readonly offers: SaleOffersService) {}

  @Post()
  @ApiOperation({ summary: 'Faire une offre sur un bien en vente (acheteur)' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateSaleOfferDto,
  ) {
    return this.offers.createForProperty(propertyId, current.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Offres du bien (gestionnaire/owner = fil complet ; acheteur = ses offres)',
  })
  list(
    @CurrentUser() current: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ) {
    return this.offers.listForProperty(propertyId, current.userId);
  }
}

@ApiTags('Sale offers')
@ApiBearerAuth()
@Controller('sales/offers')
@UseGuards(AppAuthGuard)
export class SaleOffersActionsController {
  constructor(private readonly offers: SaleOffersService) {}

  @Get('mine')
  @ApiOperation({ summary: "Les offres de l'acheteur connecté" })
  mine(@CurrentUser() current: AuthenticatedUser) {
    return this.offers.listMine(current.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'une offre (acheteur ou côté vente)" })
  getOne(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.offers.getOne(id, current.userId);
  }

  @Post(':id/forward')
  @ApiOperation({ summary: "Transmettre l'offre au propriétaire (côté vente)" })
  forward(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.offers.forward(id, current.userId);
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: "Accepter l'offre → bien UNDER_OFFER, autres rejetées",
  })
  accept(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.offers.accept(id, current.userId);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: "Refuser l'offre (côté vente ou acheteur sur contre-offre)",
  })
  reject(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectOfferDto,
  ) {
    return this.offers.reject(id, current.userId, dto.note);
  }

  @Post(':id/counter')
  @ApiOperation({ summary: 'Contre-proposer (acheteur comme côté vente)' })
  counter(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CounterOfferDto,
  ) {
    return this.offers.counter(id, current.userId, dto);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Retirer son offre (acheteur)' })
  withdraw(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.offers.withdraw(id, current.userId);
  }

  @Post(':id/agreement')
  @ApiOperation({
    summary: "Générer un compromis DRAFT depuis l'offre acceptée",
  })
  draftAgreement(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.offers.draftAgreement(id, current.userId);
  }
}
