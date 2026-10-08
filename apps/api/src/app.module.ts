import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountModule } from './account/account.module';
import { AccountingModule } from './accounting/accounting.module';
import { AdminModule } from './admin/admin.module';
import { AgentModule } from './agent/agent.module';
import { AgencyModule } from './organizations/agency.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { FavoritesModule } from './favorites/favorites.module';
import { DepositsModule } from './deposits/deposits.module';
import { LeasesModule } from './leases/leases.module';
import { LocationsModule } from './locations/locations.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MandatesModule } from './mandates/mandates.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PayoutsModule } from './payouts/payouts.module';
import { SalesModule } from './sales/sales.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OwnerModule } from './owner/owner.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { ReportsModule } from './reports/reports.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { VisitSlotsModule } from './visit-slots/visit-slots.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventModule,
    AccountModule,
    AdminModule,
    AgentModule,
    OwnerModule,
    AuthModule,
    OrganizationsModule,
    AgencyModule,
    UsersModule,
    AccountingModule,
    HealthModule,
    LocationsModule,
    PropertiesModule,
    ReportsModule,
    VisitSlotsModule,
    BookingsModule,
    FavoritesModule,
    LeasesModule,
    DepositsModule,
    ApplicationsModule,
    TenantsModule,
    MaintenanceModule,
    MandatesModule,
    MediaModule,
    NotificationsModule,
    PaymentsModule,
    PayoutsModule,
    SalesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
