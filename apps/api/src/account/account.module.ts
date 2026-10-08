import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminKycController } from './admin-kyc.controller';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

/**
 * Spec 01 — account compliance surface:
 *  - personal-data export (`users/me/export`)
 *  - KYC submissions (`kyc/submissions`) and the admin review queue.
 */
@Module({
  imports: [PrismaModule, MediaModule, AuthModule],
  controllers: [DataExportController, KycController, AdminKycController],
  providers: [DataExportService, KycService],
})
export class AccountModule {}
