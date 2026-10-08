import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PayoutsService } from './payouts.service';
import {
  CreatePayoutAccountDto,
  UpdatePayoutAccountDto,
  UpdatePayoutSettingsDto,
  VerifyPayoutAccountDto,
} from './dto/payouts.dto';

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller('organizations/:id/payout-accounts')
@UseGuards(AppAuthGuard)
export class PayoutAccountsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'Comptes de reversement de l’organisation' })
  list(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
  ) {
    return this.payouts.listAccounts(current.userId, orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un compte de reversement' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
    @Body() dto: CreatePayoutAccountDto,
  ) {
    return this.payouts.createAccount(current.userId, orgId, dto);
  }

  @Patch(':accountId')
  @ApiOperation({ summary: 'Modifier un compte (défaut, titulaire)' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdatePayoutAccountDto,
  ) {
    return this.payouts.updateAccount(current.userId, orgId, accountId, dto);
  }

  @Post(':accountId/verify')
  @ApiOperation({
    summary: 'Vérifier un compte (sandbox : code 1 = micro-dépôt 1 XAF)',
  })
  verify(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
    @Param('accountId') accountId: string,
    @Body() dto: VerifyPayoutAccountDto,
  ) {
    return this.payouts.verifyAccount(
      current.userId,
      orgId,
      accountId,
      dto.code,
    );
  }

  @Delete(':accountId')
  @ApiOperation({ summary: 'Supprimer un compte de reversement' })
  remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.payouts.deleteAccount(current.userId, orgId, accountId);
  }
}

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller('organizations/:id/payout-settings')
@UseGuards(AppAuthGuard)
export class PayoutSettingsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'Fréquence et montant minimum actuels' })
  getSettings(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
  ) {
    return this.payouts.getSettings(current.userId, orgId);
  }

  @Patch()
  @ApiOperation({ summary: 'Fréquence et montant minimum de reversement' })
  updateSettings(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') orgId: string,
    @Body() dto: UpdatePayoutSettingsDto,
  ) {
    return this.payouts.updateSettings(current.userId, orgId, dto);
  }
}
