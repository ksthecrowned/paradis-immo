import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminOrganizationRequestsController,
  AgencyController,
} from './agency.controller';
import { AgencyService } from './agency.service';
import {
  InvitationsController,
  ReviewEligibilityController,
  ReviewsController,
} from './invitations.controller';

/**
 * Spec 02 — agencies, teams, invitations and real reviews.
 *
 * Kept separate from `OrganizationsModule` (which stays public / read-only)
 * so this module can depend on R2 + auth services without creating an import
 * cycle through the global organizations provider.
 */
@Module({
  imports: [PrismaModule, AuthModule, MediaModule],
  controllers: [
    AgencyController,
    AdminOrganizationRequestsController,
    InvitationsController,
    ReviewsController,
    ReviewEligibilityController,
  ],
  providers: [AgencyService],
  exports: [AgencyService],
})
export class AgencyModule {}
