import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Back-office endpoints restricted to PLATFORM_ADMIN.
 *
 * Exposes three operational reads / writes:
 *  - GET    /admin/users          paginated user list
 *  - GET    /admin/stats          aggregated platform counters
 *  - PATCH  /admin/properties/:id/moderate
 *           flip a Property.status (ACTIVE / PAUSED / ARCHIVED)
 *
 * All routes are guarded by `AppAuthGuard + RolesGuard(PLATFORM_ADMIN)`.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
