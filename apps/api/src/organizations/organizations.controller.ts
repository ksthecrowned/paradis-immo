import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizationsService } from './organizations.service';

class ReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(50)
  pageSize?: number;
}

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

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Paginated public reviews for an organization' })
  listReviews(@Param('id') id: string, @Query() query: ReviewsQueryDto) {
    return this.organizations.listReviews(id, query.page, query.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public organization with agents' })
  get(@Param('id') id: string) {
    return this.organizations.getPublic(id);
  }
}
