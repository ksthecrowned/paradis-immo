import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { InspectionType, ItemCondition } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  InspectionsService,
  UpdateInspectionPayload,
} from './inspections.service';

class InspectionItemDto {
  @IsString() @MaxLength(200) label!: string;
  @IsEnum(ItemCondition) condition!: ItemCondition;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) photoKeys?: string[];
}

class InspectionRoomDto {
  @IsString() @MaxLength(120) name!: string;
  @Type(() => InspectionItemDto)
  @ValidateNested({ each: true })
  items!: InspectionItemDto[];
}

class CreateInspectionDto {
  @IsEnum(InspectionType) type!: InspectionType;
}

class UpdateInspectionDto implements UpdateInspectionPayload {
  @IsOptional() @IsString() @MaxLength(2000) generalComment?: string;
  @IsOptional() meters?: { water?: string; electricity?: string };
  @IsOptional()
  keys?: Array<{ label: string; count: number }>;
  @IsOptional()
  @Type(() => InspectionRoomDto)
  @ValidateNested({ each: true })
  rooms?: InspectionRoomDto[];
}

class SignInspectionDto {
  /** true = signature locataire ; false (défaut) = signature gestionnaire. */
  @IsOptional() @IsBoolean() asTenant?: boolean;
}

class ReserveDto {
  @IsString() @MaxLength(2000) text!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) photoKeys?: string[];
}

@ApiTags('Inspections')
@ApiBearerAuth()
@Controller()
@UseGuards(AppAuthGuard)
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Post('leases/:id/inspections')
  @ApiOperation({ summary: 'Crée un EDL (CHECK_IN ou CHECK_OUT) sur le bail' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') leaseId: string,
    @Body() dto: CreateInspectionDto,
  ) {
    return this.inspections.create(current.userId, leaseId, dto.type);
  }

  @Put('inspections/:id')
  @ApiOperation({ summary: 'Brouillon : pièces, items, compteurs, clés' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
  ) {
    return this.inspections.update(current.userId, id, {
      generalComment: dto.generalComment,
      meters: dto.meters,
      keys: dto.keys,
      rooms: dto.rooms,
    });
  }

  @Post('inspections/:id/sign')
  @ApiOperation({ summary: "Signature d'une partie (tenant ou gestionnaire)" })
  sign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SignInspectionDto,
  ) {
    return this.inspections.sign(current.userId, id, dto.asTenant === true);
  }

  @Post('inspections/:id/reserves')
  @ApiOperation({ summary: 'Réserves du locataire (10 jours après signature)' })
  addReserve(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReserveDto,
  ) {
    return this.inspections.addReserve(
      current.userId,
      id,
      dto.text,
      dto.photoKeys ?? [],
    );
  }

  @Get('inspections/:id')
  @ApiOperation({ summary: "Détail de l'EDL (pièces + items + réserves)" })
  getOne(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.inspections.getOne(current.userId, id);
  }

  @Get('leases/:id/inspections-compare')
  @ApiOperation({ summary: 'Comparatif entrée/sortie (écarts = retenues)' })
  compare(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') leaseId: string,
  ) {
    return this.inspections.compare(current.userId, leaseId);
  }
}
