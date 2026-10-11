import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { StaySettingsService } from './stay-settings.service';
import {
  CreateSeasonalRateDto,
  UpdateSeasonalRateDto,
  UpsertStaySettingsDto,
} from './dto/stay-settings.dto';

/**
 * Spec 07 — paramètres de séjour et tarifs saisonniers (gestionnaire).
 * `GET` reste ouverte aux utilisateurs authentifiés (lecture utilisée par
 * l'UI d'édition), les écritures sont filtrées dans le service par mandat.
 */
@ApiTags('Stays')
@ApiBearerAuth()
@Controller()
export class StaySettingsController {
  constructor(private readonly staySettings: StaySettingsService) {}

  @Get('properties/:id/stay-settings')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Paramètres de séjour du bien (spec 07)' })
  getSettings(@Param('id') id: string) {
    return this.staySettings.getSettings(id);
  }

  @Put('properties/:id/stay-settings')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Créer/mettre à jour les paramètres de séjour' })
  upsertSettings(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertStaySettingsDto,
  ) {
    return this.staySettings.upsertSettings(
      current.userId,
      id,
      dto as unknown as Record<string, unknown>,
    );
  }

  @Get('properties/:id/seasonal-rates')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Liste des tarifs saisonniers' })
  listRates(@Param('id') id: string) {
    return this.staySettings.listSeasonalRates(id);
  }

  @Post('properties/:id/seasonal-rates')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Créer un tarif saisonnier' })
  createRate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateSeasonalRateDto,
  ) {
    return this.staySettings.createSeasonalRate(current.userId, id, dto);
  }

  @Patch('properties/:id/seasonal-rates/:rateId')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Modifier un tarif saisonnier' })
  updateRate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Param('rateId') rateId: string,
    @Body() dto: UpdateSeasonalRateDto,
  ) {
    return this.staySettings.updateSeasonalRate(
      current.userId,
      id,
      rateId,
      dto,
    );
  }

  @Delete('properties/:id/seasonal-rates/:rateId')
  @UseGuards(AppAuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer un tarif saisonnier' })
  async deleteRate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Param('rateId') rateId: string,
  ): Promise<void> {
    await this.staySettings.deleteSeasonalRate(current.userId, id, rateId);
  }
}
