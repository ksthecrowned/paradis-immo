import {
  Body,
  Controller,
  Delete,
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
import { LeaseTemplatesService } from './lease-templates.service';
import {
  CreateLeaseTemplateDto,
  UpdateLeaseTemplateDto,
} from './dto/lease-template.dto';

@ApiTags('LeaseTemplates')
@ApiBearerAuth()
@Controller('organizations/:organizationId/lease-templates')
@UseGuards(AppAuthGuard)
export class LeaseTemplatesController {
  constructor(private readonly templates: LeaseTemplatesService) {}

  @Get()
  @ApiOperation({ summary: "List the agency's lease templates" })
  list(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
  ) {
    return this.templates.list(current.userId, organizationId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a lease template' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateLeaseTemplateDto,
  ) {
    return this.templates.create(current.userId, organizationId, dto);
  }

  @Patch(':templateId')
  @ApiOperation({ summary: 'Update a lease template' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateLeaseTemplateDto,
  ) {
    return this.templates.update(current.userId, organizationId, templateId, dto);
  }

  @Delete(':templateId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a lease template' })
  remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('organizationId') organizationId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templates.remove(current.userId, organizationId, templateId);
  }
}