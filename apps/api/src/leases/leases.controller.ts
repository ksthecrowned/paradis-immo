import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeasesService } from './leases.service';
import { ListLeasesDto } from './dto/list-leases.dto';
import { CreateLeaseDto } from './dto/create-lease.dto';

@ApiTags('Leases')
@ApiBearerAuth()
@Controller('leases')
@UseGuards(AppAuthGuard)
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a draft lease' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateLeaseDto,
  ) {
    return this.leases.createLease(current.userId, dto);
  }

  @Get('managed')
  @UseGuards(AppAuthGuard)
  @ApiOperation({
    summary: 'List leases on properties the user owns or manages',
  })
  managed(
    @CurrentUser() current: AuthenticatedUser,
    @Query() filter: ListLeasesDto,
  ) {
    return this.leases.listManaged(current.userId, filter);
  }

  @Get('my')
  @ApiOperation({ summary: "List the authenticated tenant's leases" })
  my(@CurrentUser() current: AuthenticatedUser) {
    return this.leases.listMyLeases(current.userId);
  }

  @Post(':id/request-sign')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Request owner LEASE_SIGN approval (mandated properties)',
  })
  requestSign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.requestLeaseSign(current.userId, id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a draft lease (generates rent schedule)' })
  activate(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.leases.activateLease(current.userId, id);
  }

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get the rent schedule for a lease' })
  schedule(@Param('id') id: string) {
    return this.leases.getSchedule(id);
  }
}
