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
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { AgencyClientsService } from './agency-clients.service';
import {
  CreateExternalAgencyClientDto,
  LinkExistingUserDto,
  ListAgencyClientsQueryDto,
  LookupAgencyClientPhoneDto,
  UpdateAgencyClientDto,
} from './dto/agency-client.dto';

@ApiTags('AgencyClients')
@ApiBearerAuth()
@Controller('organizations/:organizationId/clients')
@UseGuards(AppAuthGuard)
export class AgencyClientsController {
  constructor(private readonly clients: AgencyClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List CRM clients for an agency (ADMIN/AGENT)' })
  list(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Query() query: ListAgencyClientsQueryDto,
  ) {
    return this.clients.list(current.userId, organizationId, query);
  }

  @Get('selectable')
  @ApiOperation({
    summary: 'Clients selectable when attaching a property (ADMIN/AGENT)',
  })
  selectable(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Query('q') q?: string,
  ) {
    return this.clients.listSelectable(current.userId, organizationId, q);
  }

  @Post('lookup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Minimal account lookup by phone (ADMIN only, rate-limited)',
  })
  lookup(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: LookupAgencyClientPhoneDto,
  ) {
    return this.clients.lookupAccount(current.userId, organizationId, dto.phone);
  }

  @Post('external')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an external contact without a User (ADMIN)' })
  createExternal(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateExternalAgencyClientDto,
  ) {
    return this.clients.createExternal(current.userId, organizationId, dto);
  }

  @Post('link')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Add an existing account to the CRM (ADMIN); sends info notification',
  })
  link(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: LinkExistingUserDto,
  ) {
    return this.clients.linkExistingUser(current.userId, organizationId, dto);
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'CRM client detail' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.clients.getOne(current.userId, organizationId, clientId);
  }

  @Patch(':clientId')
  @ApiOperation({ summary: 'Update CRM client (ADMIN)' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('clientId') clientId: string,
    @Body() dto: UpdateAgencyClientDto,
  ) {
    return this.clients.update(current.userId, organizationId, clientId, dto);
  }

  @Post(':clientId/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive CRM client (ADMIN)' })
  archive(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('clientId') clientId: string,
  ) {
    return this.clients.archive(current.userId, organizationId, clientId);
  }
}
