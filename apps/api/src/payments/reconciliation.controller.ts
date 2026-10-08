import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsString } from 'class-validator';
import { PaymentProvider } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReconciliationService } from './reconciliation.service';

/** POST admin/reconciliation — import d'un relevé fournisseur. */
class ImportReconciliationDto {
  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  /** Contenu CSV du relevé : `providerRef,amount,date` (en-tête accepté). */
  @IsString()
  csv!: string;

  @Type(() => Date)
  @IsDate()
  periodStart!: Date;

  @Type(() => Date)
  @IsDate()
  periodEnd!: Date;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/reconciliation')
@UseGuards(AppAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}

  @Post()
  @ApiOperation({ summary: 'Import d’un relevé fournisseur (rapprochement)' })
  import(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ImportReconciliationDto,
  ) {
    return this.reconciliation.importRun(dto, current.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Écarts d’un run de rapprochement' })
  getRun(@Param('id') id: string) {
    return this.reconciliation.getRun(id);
  }
}
