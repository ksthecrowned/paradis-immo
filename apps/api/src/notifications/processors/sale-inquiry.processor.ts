import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 08 — `SALE_INQUIRY_CREATED` : le propriétaire (ou l'org gérante) est
 * notifié d'une nouvelle demande d'achat avec le budget et le téléphone.
 */
@Injectable()
export class SaleInquiryNotificationProcessor {
  private readonly logger = new Logger(SaleInquiryNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.SALE_INQUIRY_CREATED)
  async handle(
    event: DomainEvent<{
      inquiryId: string;
      propertyId: string;
      buyerUserId: string;
    }>,
  ): Promise<void> {
    const { inquiryId, propertyId, buyerUserId } = event.payload;
    if (!inquiryId || !propertyId || !buyerUserId) return;

    const [property, inquiry] = await Promise.all([
      this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { ownerId: true, title: true },
      }),
      this.prisma.saleInquiry.findUnique({
        where: { id: inquiryId },
        select: {
          budget: true,
          phone: true,
          user: { select: { name: true } },
        },
      }),
    ]);
    if (!property) return;

    await this.notifications.send({
      userId: property.ownerId,
      type: 'SALE_INQUIRY_CREATED',
      payload: {
        inquiryId,
        propertyTitle: property.title,
        buyerName: inquiry?.user.name ?? null,
        budget: inquiry?.budget?.toString() ?? null,
        phone: inquiry?.phone ?? null,
      },
    });
    this.logger.log(
      `Owner ${property.ownerId} notified of inquiry ${inquiryId}`,
    );
  }
}
