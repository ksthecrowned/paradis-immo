import { Controller, Get, Query } from '@nestjs/common';
import {
  ArrondissementsQueryDto,
  CitiesQueryDto,
  QuartiersQueryDto,
} from './dto/locations-query.dto';
import { LocationsService } from './locations.service';

/**
 * Read-only location endpoints powering the cascading filter
 * (country → city → arrondissement → quartier) used by both web and mobile.
 *
 * All routes are public — no auth required, as the data is purely
 * geographic and used for browsing.
 */
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('cities')
  listCities(@Query() query: CitiesQueryDto) {
    return this.locations.listCities(query.countryCode);
  }

  @Get('arrondissements')
  listArrondissements(@Query() query: ArrondissementsQueryDto) {
    return this.locations.listArrondissements(query.cityId);
  }

  @Get('quartiers')
  listQuartiers(@Query() query: QuartiersQueryDto) {
    return this.locations.listQuartiers(query.arrondissementId);
  }
}
