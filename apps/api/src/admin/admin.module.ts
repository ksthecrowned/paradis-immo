import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { AuditLogModule } from '../common/audit-log.module';
import { AuditLogService } from '../common/audit-log.service';
import { MandatesModule } from '../mandates/mandates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminPermissionGuard } from './admin-permission.guard';

/**
 * Back-office endpoints restricted to PLATFORM_ADMIN.
 *
 * Exposes three operational reads / writes:
 *  - GET    /admin/users          paginated user list
 *  - GET    /admin/stats          aggregated platform counters
 *  - PATCH  /admin/properties/:id/moderate
 *           flip a Property.status (ACTIVE / PAUSED / ARCHIVED)
 *  - GET    /admin/notifications/failed
 *  - POST   /admin/notifications/:id/retry
 *
 * All routes are guarded by `AppAuthGuard + RolesGuard(PLATFORM_ADMIN)`.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventModule,
    AuditLogModule,
    MandatesModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, AdminPermissionGuard],
  exports: [AdminService, AuditLogService],
})
export class AdminModule {}
