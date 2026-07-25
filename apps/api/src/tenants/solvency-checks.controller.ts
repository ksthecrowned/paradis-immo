import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RespondSolvencyCheckDto } from './dto/respond-solvency-check.dto';
import { SolvencyChecksService } from './solvency-checks.service';

@ApiTags('Solvency')
@ApiBearerAuth()
@Controller('tenants/:userId/solvency-checks')
@UseGuards(AppAuthGuard)
export class TenantSolvencyChecksController {
  constructor(private readonly solvency: SolvencyChecksService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Request solvency check for a managed tenant' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.solvency.create(current.userId, userId);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Latest solvency check for this org + tenant' })
  latest(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.solvency.latestForOrg(current.userId, userId);
  }
}

@ApiTags('Solvency')
@ApiBearerAuth()
@Controller('me/solvency-checks')
@UseGuards(AppAuthGuard)
export class MeSolvencyChecksController {
  constructor(private readonly solvency: SolvencyChecksService) {}

  @Get()
  @ApiOperation({ summary: 'List solvency check requests for current tenant' })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.solvency.listForTenant(current.userId);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept or deny a solvency check request' })
  respond(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondSolvencyCheckDto,
  ) {
    return this.solvency.respond(current.userId, id, dto.accept);
  }
}
