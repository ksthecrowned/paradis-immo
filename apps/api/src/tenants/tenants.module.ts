import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MandatesModule } from '../mandates/mandates.module';
import { MediaModule } from '../media/media.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantDocumentsController } from './tenant-documents.controller';
import { TenantDocumentsService } from './tenant-documents.service';

@Module({
  imports: [PrismaModule, MandatesModule, MediaModule],
  controllers: [TenantsController, TenantDocumentsController],
  providers: [TenantsService, TenantDocumentsService],
  exports: [TenantsService, TenantDocumentsService],
})
export class TenantsModule {}
