import {
  Body,
  Controller,
  Delete,
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
import { RentalApplicationsService } from './rental-applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsDto } from './dto/list-applications.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { CreateApplicationLeaseDto } from './dto/create-application-lease.dto';

/**
 * Spec 04 — candidatures scoped to a property.
 *
 * `POST` is open to any authenticated seeker; `GET` is restricted to the
 * manager of the property (checked by the service via AgencyAccessService).
 */
@ApiTags('Rental applications')
@ApiBearerAuth()
@Controller('properties/:propertyId/applications')
@UseGuards(AppAuthGuard)
export class PropertyApplicationsController {
  constructor(private readonly applications: RentalApplicationsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Apply to a RENT_LONG listing' })
  apply(
    @CurrentUser() current: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applications.apply(current.userId, propertyId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List applications on a property (manager)' })
  listForProperty(
    @CurrentUser() current: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
    @Query() filter: ListApplicationsDto,
  ) {
    return this.applications.listForProperty(
      current.userId,
      propertyId,
      filter,
    );
  }
}

@ApiTags('Rental applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(AppAuthGuard)
export class ApplicationsController {
  constructor(private readonly applications: RentalApplicationsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'List my own applications' })
  mine(@CurrentUser() current: AuthenticatedUser) {
    return this.applications.listMine(current.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Withdraw one of my applications' })
  withdraw(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.applications.withdraw(current.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Accept or reject an application (manager)' })
  decide(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applications.decide(current.userId, id, dto);
  }

  @Post(':id/solvency-checks')
  @HttpCode(201)
  @ApiOperation({ summary: 'Request a solvency consent from the candidate' })
  requestSolvencyCheck(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.applications.requestSolvencyCheck(current.userId, id);
  }

  @Post(':id/lease')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a DRAFT lease from an accepted application' })
  createLease(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateApplicationLeaseDto,
  ) {
    return this.applications.createLeaseFromApplication(
      current.userId,
      id,
      dto,
    );
  }
}