import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropertyReportStatus, PropertyStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuditLogService } from '../common/audit-log.service';
import {
  AdminPermissionGuard,
  AdminPermission,
} from './admin-permission.guard';
import { PrismaService } from '../prisma/prisma.service';
import { generateTotpSecret, verifyTotp } from './totp';
import { BadRequestException, NotFoundException } from '@nestjs/common';

class ModeratePropertyDto {
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class SetFeaturedDto {
  @IsBoolean()
  isFeatured!: boolean;
}

class UpdateReportDto {
  @IsEnum(PropertyReportStatus)
  status!: PropertyReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

class SuspendUserDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

class SetupTotpDto {
  @IsString()
  @MaxLength(256)
  code!: string;
}

class VerifyTotpDto {
  @IsString()
  @MaxLength(10)
  code!: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AppAuthGuard, RolesGuard, AdminPermissionGuard)
@Roles('PLATFORM_ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly auth: AuthService,
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stats')
  @AdminPermission('stats.read')
  @ApiOperation({
    summary: 'Get platform-wide statistics and chart series',
  })
  async stats(@Query('range') range?: string) {
    const safeRange =
      range === '1m' || range === '6m' || range === '1y' ? range : '1y';
    const data = await this.admin.getStats(safeRange);
    return { statusCode: 200, data };
  }

  @Get('users')
  @AdminPermission('users.read')
  @ApiOperation({ summary: 'List all users' })
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize: number,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.admin.listUsers(safePage, safeSize);
    return { statusCode: 200, ...result };
  }

  @Get('users/:id')
  @AdminPermission('users.read')
  @ApiOperation({ summary: 'Get user details for platform administration' })
  async getUserDetail(@Param('id') id: string) {
    const data = await this.admin.getUserDetail(id);
    return { statusCode: 200, data };
  }

  @Get('properties/moderation')
  @AdminPermission('moderation')
  @ApiOperation({ summary: 'List property owners for moderation' })
  async listPropertiesForModeration(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const safeLimit = Math.min(100, Math.max(1, limit));
    const result = await this.admin.listPropertiesForModeration(safeLimit);
    return {
      statusCode: 200,
      data: result.data,
      meta: { total: result.total, limit: safeLimit, offset: 0 },
    };
  }

  @Get('reports')
  @AdminPermission('moderation')
  @ApiOperation({ summary: 'List property reports for moderation' })
  async listReports(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize: number,
    @Query('status') status?: PropertyReportStatus,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.admin.listReports(safePage, safeSize, status);
    return { statusCode: 200, ...result };
  }

  @Get('reports/:id')
  @AdminPermission('moderation')
  @ApiOperation({ summary: 'Get a property report detail' })
  async getReport(@Param('id') id: string) {
    const data = await this.admin.getReport(id);
    return { statusCode: 200, data };
  }

  @Patch('reports/:id')
  @HttpCode(200)
  @AdminPermission('moderation')
  @ApiOperation({ summary: 'Update a property report status' })
  async updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    const data = await this.admin.updateReport(id, dto.status, dto.adminNote);
    return { statusCode: 200, data };
  }

  @Patch('properties/:id/moderate')
  @HttpCode(200)
  @AdminPermission('moderation')
  @ApiOperation({
    summary:
      'Moderate a property (status + motif, notifié au propriétaire — spec 15 A2)',
  })
  async moderate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModeratePropertyDto,
  ) {
    const updated = await this.admin.moderateProperty(
      id,
      dto.status,
      current.userId,
      dto.reason,
    );
    return {
      statusCode: 200,
      data: {
        id: updated.id,
        status: updated.status,
        ownerId: updated.ownerId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  @Patch('properties/:id/featured')
  @HttpCode(200)
  @AdminPermission('moderation')
  @ApiOperation({
    summary: 'Feature or unfeature a property (marketplace highlight)',
  })
  async setFeatured(@Param('id') id: string, @Body() dto: SetFeaturedDto) {
    const updated = await this.admin.setPropertyFeatured(id, dto.isFeatured);
    return {
      statusCode: 200,
      data: {
        id: updated.id,
        isFeatured: updated.isFeatured,
        ownerId: updated.ownerId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  @Get('audit-logs')
  @HttpCode(200)
  @AdminPermission('audit.read')
  @ApiOperation({
    summary: 'Journal d’audit (spec 15 A3) — filtrable et paginé',
  })
  async listAuditLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe)
    pageSize: number,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('actorId') actorId?: string,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(200, Math.max(1, pageSize));
    const result = await this.auditLog.list({
      action,
      targetType,
      targetId,
      actorId,
      limit: safeSize,
      offset: (safePage - 1) * safeSize,
    });
    return {
      statusCode: 200,
      data: result.data,
      meta: {
        total: result.total,
        page: safePage,
        pageSize: safeSize,
      },
    };
  }

  @Patch('users/:id/suspend')
  @HttpCode(200)
  @AdminPermission('users.suspend')
  @ApiOperation({
    summary:
      'Suspend an account: blocks every route and revokes all sessions (spec 01)',
  })
  async suspendUser(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    const result = await this.auth.suspendUser(id, dto.reason);
    // Spec 15 A3 — toute suspension admin est audité avec le motif.
    await this.admin.auditSuspension(current.userId, id, 'SUSPEND', dto.reason);
    return { statusCode: 200, data: { id, status: 'SUSPENDED', ...result } };
  }

  @Patch('users/:id/unsuspend')
  @HttpCode(200)
  @AdminPermission('users.suspend')
  @ApiOperation({ summary: 'Lift a suspension (spec 01)' })
  async unsuspendUser(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.auth.unsuspendUser(id);
    await this.admin.auditSuspension(current.userId, id, 'UNSUSPEND');
    return { statusCode: 200, data: { id, status: 'ACTIVE' } };
  }

  // Spec 15 B2 — TOTP setup/verify chain ; setup = provision (generate secret,
  // return base32), verify = confirm avec un code => active l'admin + log audit.
  @Get('security/totp')
  @AdminPermission('admins.manage')
  @ApiOperation({ summary: 'Current TOTP status of the admin user' })
  async getTotpState(@CurrentUser() current: AuthenticatedUser) {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId: current.userId },
      select: { totpSecret: true, totpEnabledAt: true },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'ADMIN_PROFILE_NOT_FOUND',
        message: 'Aucun profil admin pour cet utilisateur',
      });
    }
    return {
      statusCode: 200,
      data: {
        enabled: !!profile.totpEnabledAt,
        hasSecret: !!profile.totpSecret,
      },
    };
  }

  @Post('security/totp/setup')
  @HttpCode(201)
  @AdminPermission('admins.manage')
  @ApiOperation({
    summary: 'Provision a TOTP secret for the admin (returns base32 secret)',
  })
  async setupTotp(@CurrentUser() current: AuthenticatedUser) {
    let profile = await this.prisma.adminProfile.findUnique({
      where: { userId: current.userId },
      select: {
        userId: true,
        totpSecret: true,
        totpEnabledAt: true,
        role: true,
      },
    });

    // Le profil peut ne pas exister encore pour un SUPER_ADMIN ; on le crée.
    if (!profile) {
      await this.prisma.adminProfile.create({
        data: { userId: current.userId, role: 'SUPER_ADMIN', ipAllowlist: [] },
      });
      profile = await this.prisma.adminProfile.findUniqueOrThrow({
        where: { userId: current.userId },
        select: {
          userId: true,
          totpSecret: true,
          totpEnabledAt: true,
          role: true,
        },
      });
    }

    if (profile.totpEnabledAt) {
      throw new BadRequestException({
        code: 'TOTP_ALREADY_ENABLED',
        message: 'Le TOTP est déjà activé pour cet administrateur',
      });
    }

    const existingSecret = profile.totpSecret ?? generateTotpSecret();

    await this.prisma.adminProfile.update({
      where: { userId: current.userId },
      data: { totpSecret: existingSecret },
    });

    return {
      statusCode: 201,
      data: {
        secret: existingSecret,
        note: 'À saisir dans l’app comme code d’authentification à deux facteurs.',
      },
    };
  }

  @Patch('security/totp/setup')
  @HttpCode(200)
  @AdminPermission('admins.manage')
  @ApiOperation({
    summary: 'Activate TOTP after verifying the first code (setup → verify)',
  })
  async confirmTotp(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetupTotpDto,
  ) {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId: current.userId },
      select: { userId: true, totpSecret: true, totpEnabledAt: true },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'ADMIN_PROFILE_NOT_FOUND',
        message: 'Aucun profil admin pour cet utilisateur',
      });
    }
    if (!profile.totpSecret) {
      throw new BadRequestException({
        code: 'TOTP_SECRET_MISSING',
        message:
          'Le secret TOTP doit d’abord être provisionné (POST /admin/security/totp/setup)',
      });
    }
    if (profile.totpEnabledAt) {
      throw new BadRequestException({
        code: 'TOTP_ALREADY_ENABLED',
        message: 'Le TOTP est déjà activé pour cet administrateur',
      });
    }
    if (!verifyTotp(profile.totpSecret, dto.code)) {
      throw new BadRequestException({
        code: 'TOTP_CODE_INVALID',
        message: 'Code TOTP invalide',
      });
    }

    const updated = await this.prisma.adminProfile.update({
      where: { userId: current.userId },
      data: {
        totpEnabledAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorId: current.userId,
      action: 'admin.totp.setup',
      targetType: 'ADMIN',
      targetId: current.userId,
      after: { totpEnabledAt: updated.totpEnabledAt?.toISOString() ?? null },
    });

    return { statusCode: 200, data: { enabled: true } };
  }

  @Post('security/totp/verify')
  @HttpCode(200)
  @AdminPermission('admins.manage')
  @ApiOperation({
    summary:
      'Verify a TOTP code for the admin (used before sensitive finance actions in tests)',
  })
  async verifyTotp(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: VerifyTotpDto,
  ) {
    const profile = await this.prisma.adminProfile.findUnique({
      where: { userId: current.userId },
      select: { userId: true, totpSecret: true, totpEnabledAt: true },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'ADMIN_PROFILE_NOT_FOUND',
        message: 'Aucun profil admin pour cet utilisateur',
      });
    }
    if (!profile.totpSecret) {
      throw new BadRequestException({
        code: 'TOTP_NOT_PROVISIONED',
        message: 'Le TOTP n’est pas provisionné pour cet administrateur',
      });
    }
    if (!profile.totpEnabledAt) {
      throw new BadRequestException({
        code: 'TOTP_NOT_ENABLED',
        message: 'Le TOTP n’est pas activé pour cet administrateur',
      });
    }
    if (!verifyTotp(profile.totpSecret, dto.code)) {
      throw new BadRequestException({
        code: 'TOTP_CODE_INVALID',
        message: 'Code TOTP invalide',
      });
    }
    return { statusCode: 200, data: { valid: true } };
  }
}
