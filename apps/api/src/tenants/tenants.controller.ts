import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(AppAuthGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('managed')
  @ApiOperation({ summary: 'List tenants on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.tenants.listManaged(current.userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Tenant dossier for a managed tenant' })
  one(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.tenants.getManagedTenant(current.userId, userId);
  }
}
