import { Module } from '@nestjs/common';
import { AuditLogModule } from '../common/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { MandatesModule } from '../mandates/mandates.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AgencyClientsController } from './agency-clients.controller';
import { AgencyClientsService } from './agency-clients.service';

@Module({
  imports: [PrismaModule, AuthModule, MandatesModule, AuditLogModule],
  controllers: [AgencyClientsController],
  providers: [AgencyClientsService],
  exports: [AgencyClientsService],
})
export class AgencyClientsModule {}
