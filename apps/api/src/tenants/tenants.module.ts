import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { MediaModule } from '../media/media.module';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantDocumentsController } from './tenant-documents.controller';
import { TenantDocumentsService } from './tenant-documents.service';
import { SolvencyChecksService } from './solvency-checks.service';
import {
  MeSolvencyChecksController,
  TenantSolvencyChecksController,
} from './solvency-checks.controller';

@Module({
  imports: [PrismaModule, EventModule, MandatesModule, MediaModule],
  controllers: [
    TenantsController,
    TenantDocumentsController,
    TenantSolvencyChecksController,
    MeSolvencyChecksController,
  ],
  providers: [TenantsService, TenantDocumentsService, SolvencyChecksService],
  exports: [TenantsService, TenantDocumentsService, SolvencyChecksService],
})
export class TenantsModule {}
