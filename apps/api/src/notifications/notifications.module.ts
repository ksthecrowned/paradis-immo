import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsService } from './notifications.service';
import {
  NotificationsController,
  UserDevicesController,
} from './notifications.controller';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';
import { PaymentOutcomeProcessor } from './processors/payment-outcome.processor';
import { RentReminderProcessor } from './processors/rent-reminder.processor';
import { SolvencyCheckProcessor } from './processors/solvency-check.processor';
import { BuyerPaymentProofProcessor } from './processors/buyer-payment-proof.processor';
import { MandateActionProcessor } from './processors/mandate-action.processor';
import { MandateLifecycleNotificationsProcessor } from './processors/mandate-lifecycle.processor';
import { MandateRenewalProcessor } from './processors/mandate-renewal.processor';
import { LeaseCreatedProcessor } from './processors/lease-created.processor';
import { LeaseSignedProcessor } from './processors/lease-signed.processor';
import { DepositNotificationsProcessor } from './processors/deposit-notifications.processor';
import { StayLifecycleNotificationsProcessor } from './processors/stay-lifecycle.processor';
import { PayoutMessagingNotificationsProcessor } from './processors/payout-message.processor';
import { SaleInquiryNotificationProcessor } from './processors/sale-inquiry.processor';
import { SaleOfferNotificationProcessor } from './processors/sale-offer.processor';
import { PropertyModeratedProcessor } from './processors/property-moderated.processor';

@Module({
  // PaymentsModule -> LeasesModule -> NotificationsModule -> PaymentsModule
  // (spec 04: PaymentsService issues quittances through RentReceiptService).
  // forwardRef breaks the JS-level cycle that otherwise leaves the import
  // undefined at decorator evaluation time.
  imports: [PrismaModule, forwardRef(() => PaymentsModule)],
  controllers: [NotificationsController, UserDevicesController],
  providers: [
    NotificationsService,
    InfobipService,
    FcmService,
    PaymentValidatedProcessor,
    PaymentOutcomeProcessor,
    RentReminderProcessor,
    SolvencyCheckProcessor,
    BuyerPaymentProofProcessor,
    MandateActionProcessor,
    MandateLifecycleNotificationsProcessor,
    MandateRenewalProcessor,
    LeaseCreatedProcessor,
    LeaseSignedProcessor,
    DepositNotificationsProcessor,
    StayLifecycleNotificationsProcessor,
    PayoutMessagingNotificationsProcessor,
    SaleInquiryNotificationProcessor,
    SaleOfferNotificationProcessor,
    PropertyModeratedProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
