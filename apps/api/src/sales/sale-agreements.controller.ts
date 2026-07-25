import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  CreateSaleAgreementDto,
  UpdateSaleAgreementDto,
} from './dto/create-sale-agreement.dto';
import { SaleAgreementsService } from './sale-agreements.service';

@ApiTags('Sale agreements')
@ApiBearerAuth()
@Controller('sale-agreements')
@UseGuards(AppAuthGuard)
export class SaleAgreementsController {
  constructor(private readonly agreements: SaleAgreementsService) {}

  @Get()
  @ApiOperation({ summary: 'List sale agreements on managed properties' })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.agreements.listManaged(current.userId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a draft sale agreement' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateSaleAgreementDto,
  ) {
    return this.agreements.create(current.userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a managed sale agreement' })
  one(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.agreements.getOne(current.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a DRAFT sale agreement' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaleAgreementDto,
  ) {
    return this.agreements.updateDraft(current.userId, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate a draft sale agreement' })
  activate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.agreements.activate(current.userId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark sale agreement completed' })
  complete(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.agreements.complete(current.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a sale agreement' })
  cancel(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.agreements.cancel(current.userId, id);
  }
}

@ApiTags('Sale agreements')
@ApiBearerAuth()
@Controller('me/sale-agreements')
@UseGuards(AppAuthGuard)
export class MeSaleAgreementsController {
  constructor(private readonly agreements: SaleAgreementsService) {}

  @Get()
  @ApiOperation({ summary: 'List my sale agreements as buyer' })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.agreements.listMine(current.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get my sale agreement as buyer' })
  one(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.agreements.getMine(current.userId, id);
  }
}
