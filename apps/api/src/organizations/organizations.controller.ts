import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';

/**
 * Public marketplace agencies (official platform + AGENCY orgs).
 * No auth — used by mobile hubs, home row, and search filters.
 */
@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List public marketplace organizations' })
  list() {
    return this.organizations.listPublic();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public organization with agents' })
  get(@Param('id') id: string) {
    return this.organizations.getPublic(id);
  }
}
