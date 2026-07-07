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
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsString } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeasesService } from './leases.service';
import { ListLeasesDto } from './dto/list-leases.dto';

class CreateLeaseDto {
  @IsString() propertyId!: string;
  @IsString() tenantId!: string;
  @Type(() => Date) @IsDate() startDate!: Date;
  @Type(() => Date) @IsDate() endDate!: Date;
  @Type(() => Number) @IsNumber() monthlyRent!: number;
  @Type(() => Number) @IsNumber() deposit!: number;
  @IsString() currency!: string;
}

@Controller('leases')
@UseGuards(AppAuthGuard)
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateLeaseDto,
  ) {
    return this.leases.createLease(current.userId, dto);
  }

  @Get('managed')
  @UseGuards(AppAuthGuard)
  managed(
    @CurrentUser() current: AuthenticatedUser,
    @Query() filter: ListLeasesDto,
  ) {
    return this.leases.listManaged(current.userId, filter);
  }

  @Patch(':id/activate')
  activate(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.leases.activateLease(current.userId, id);
  }

  @Get(':id/schedule')
  schedule(@Param('id') id: string) {
    return this.leases.getSchedule(id);
  }
}
