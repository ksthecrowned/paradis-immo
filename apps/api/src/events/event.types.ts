// Domain events emitted across the Paradis Immo platform.
// Handled in-process via `@nestjs/event-emitter` (`@OnEvent` listeners).

export const DOMAIN_EVENTS = {
  LEASE_CREATED: 'lease.created',
  /** Spec 04 — a party signed a lease (OTP). `bothSigned` implies activation. */
  LEASE_SIGNED: 'lease.signed',
  /** Spec 04 — the manager manually chased an overdue tenant. */
  LEASE_REMINDER_SENT: 'lease.reminder.sent',
  /** Spec 04 P2 — recouvrement : pénalité de retard appliquée puis levée. */
  LATE_FEE_APPLIED: 'late_fee.applied',
  LATE_FEE_WAIVED: 'late_fee.waived',
  FORMAL_NOTICE_SENT: 'formal_notice.sent',
  /** Spec 04 P2 — avenants versionnés. */
  AMENDMENT_CREATED: 'amendment.created',
  AMENDMENT_SIGNED: 'amendment.signed',
  AMENDMENT_APPLIED: 'amendment.applied',
  /** Spec 04 P2 — révision annuelle proposée à la date anniversaire. */
  RENT_INDEXATION_PROPOSED: 'rent.indexation.proposed',
  /** Spec 04 US 11 — le bail est renouvelé (tacitement ou par proposition). */
  LEASE_RENEWED: 'lease.renewed',
  PAYMENT_VALIDATED: 'payment.validated',
  PAYMENT_INITIATED: 'payment.initiated',
  /** Spec 05 — échec d'encaissement (fournisseur ou refus). */
  PAYMENT_FAILED: 'payment.failed',
  /** Spec 05 — INITIATED non confirmé : expiré après 15 minutes. */
  PAYMENT_EXPIRED: 'payment.expired',
  /** Spec 05 — le payeur conteste (débité mais non crédité, doublon). */
  PAYMENT_DISPUTED: 'payment.disputed',
  /** Spec 05 — remboursement exécuté (total ou partiel). */
  PAYMENT_REFUNDED: 'payment.refunded',
  /** Spec 05 — reversement au propriétaire (succès / échec). */
  PAYOUT_PAID: 'payout.paid',
  PAYOUT_FAILED: 'payout.failed',
  /** Spec 10 — un message a été envoyé dans une conversation. */
  MESSAGE_CREATED: 'message.created',
  /** Spec 10 — un message a été signalé (modération). */
  MESSAGE_REPORTED: 'message.reported',
  /** Spec 06 — hold posé sur une visite payante (créneau HELD 15 min). */
  VISIT_BOOKING_HELD: 'visit_booking.held',
  /** Spec 06 — annulation d'une visite (chercheur, agence ou blackout). */
  VISIT_BOOKING_CANCELLED: 'visit_booking.cancelled',
  VISIT_BOOKING_COMPLETED: 'visit_booking.completed',
  VISIT_BOOKING_NO_SHOW: 'visit_booking.no_show',
  VISIT_BOOKING_UNCONFIRMED: 'visit_booking.completed_unconfirmed',
  VISIT_AGENT_ASSIGNED: 'visit.agent.assigned',
  VISIT_REMINDER: 'visit.reminder',
  /** Spec 07 — hold posé sur un séjour (PENDING_PAYMENT 15 min). */
  BOOKING_HELD: 'booking.held',
  /** Spec 07 — hold de séjour expiré (15 min sans paiement). */
  BOOKING_HOLD_EXPIRED: 'booking.hold.expired',
  /** Spec 07 — demande de réservation sans instant book. */
  BOOKING_REQUESTED: 'booking.requested',
  /** Spec 07 — annulation avec politique de remboursement. */
  BOOKING_CANCELLED: 'booking.cancelled',
  /** Spec 07 — hôte a accepté une demande (hold 2 h pour payer). */
  BOOKING_ACCEPTED: 'booking.accepted',
  /** Spec 07 — hôte a refusé une demande. */
  BOOKING_DECLINED: 'booking.declined',
  /** Spec 07 — demande restée sans réponse 24 h. */
  BOOKING_EXPIRED: 'booking.expired',
  /** Spec 07 — paiement validé, séjour confirmé. */
  BOOKING_CONFIRMED: 'booking.confirmed',
  /** Spec 07 — arrivée du voyageur (hôte). */
  BOOKING_CHECKED_IN: 'booking.checked_in',
  /** Spec 07 — départ du voyageur (hôte). */
  BOOKING_CHECKED_OUT: 'booking.checked_out',
  /** Spec 07 — séjour terminé. */
  BOOKING_COMPLETED: 'booking.completed',
  /** Spec 07 — dommage signalé sous 48 h (retenue caution). */
  BOOKING_DAMAGE_REPORTED: 'booking.damage_reported',
  /** Spec 15 A2 — une annonce a été modérée (motif inclus). */
  PROPERTY_MODERATED: 'property.moderated',
  /** Spec 08 — nouvelle demande d'achat sur un bien à vendre. */
  SALE_INQUIRY_CREATED: 'sale_inquiry.created',
  /** Spec 08 P1 — offre d'achat posée (acheteur ou contre-offre des deux côtés). */
  SALE_OFFER_SUBMITTED: 'sale_offer.submitted',
  /** Spec 08 P1 — décision sur une offre (acceptée, refusée, contre-proposée). */
  SALE_OFFER_DECIDED: 'sale_offer.decided',
  /** Spec 08 P1 — offre transmise au propriétaire par l'agent. */
  SALE_OFFER_FORWARDED: 'sale_offer.forwarded',
  /** Spec 07 — dates bloquées importées d'un iCal. */
  BOOKING_PICKED: 'booking.picked',
  MANDATE_ACTION_PENDING: 'mandate.action.pending',
  MANDATE_ACTION_DECIDED: 'mandate.action.decided',
  MANDATE_PROPOSED: 'mandate.proposed',
  MANDATE_ACCEPTED: 'mandate.accepted',
  MANDATE_DECLINED: 'mandate.declined',
  MANDATE_TERMINATED: 'mandate.terminated',
  MANDATE_EXPIRING: 'mandate.expiring',
  MANDATE_AGENT_ASSIGNED: 'mandate.agent.assigned',
  EXPENSE_APPROVED: 'expense.approved',
  VISIT_BOOKING_CONFIRMED: 'visit.booking.confirmed',
  MAINTENANCE_OPENED: 'maintenance.opened',
  RENT_DUE_SOON: 'rent.due.soon',
  RENT_OVERDUE: 'rent.overdue',
  SOLVENCY_CHECK_REQUESTED: 'solvency_check.requested',
  /** Spec 04 — the candidate answered a solvency consent request. */
  SOLVENCY_CHECK_DECIDED: 'solvency_check.decided',
  APPLICATION_SUBMITTED: 'application.submitted',
  APPLICATION_ACCEPTED: 'application.accepted',
  APPLICATION_REJECTED: 'application.rejected',
  APPLICATION_WITHDRAWN: 'application.withdrawn',
  /** Spec 04 — deposit (caution) lifecycle. */
  DEPOSIT_DEDUCTION_PROPOSED: 'deposit.deduction.proposed',
  DEPOSIT_DEDUCTION_CONTESTED: 'deposit.deduction.contested',
  DEPOSIT_SETTLED: 'deposit.settled',
  DEPOSIT_REFUND_DUE: 'deposit.refund.due',
  BUYER_PAYMENT_PROOF_REQUESTED: 'buyer_payment_proof.requested',
  /**
   * Internal scheduler event — fired daily at 8am Africa/Brazzaville
   * by `RentReminderProcessor`. No module emits this directly.
   */
  RENT_REMINDER_DAILY: 'rent.reminder.daily',
} as const;

export type DomainEventName =
  (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  payload: T;
  emittedAt: string;
}

export type EventPayloadOf<E extends DomainEventName> = E extends
  | typeof DOMAIN_EVENTS.PAYMENT_VALIDATED
  | typeof DOMAIN_EVENTS.PAYMENT_INITIATED
  ? { paymentId: string; userId: string; amount: string; currency: string }
  : E extends typeof DOMAIN_EVENTS.LEASE_CREATED
    ? { leaseId: string; propertyId: string; tenantId: string | null }
    : E extends typeof DOMAIN_EVENTS.LEASE_SIGNED
      ? {
          leaseId: string;
          propertyId: string;
          tenantId: string | null;
          party: 'TENANT' | 'LANDLORD';
          bothSigned: boolean;
        }
      : E extends typeof DOMAIN_EVENTS.LEASE_REMINDER_SENT
        ? {
            leaseId: string;
            propertyId: string;
            tenantId: string | null;
            amount: string;
            currency: string;
            overdueCount: number;
            channel: string;
          }
        : E extends typeof DOMAIN_EVENTS.LATE_FEE_APPLIED
          ? {
              leaseId: string;
              tenantId: string | null;
              rentScheduleId: string;
              lateFeeScheduleId: string;
              amount: string;
              currency: string;
            }
          : E extends typeof DOMAIN_EVENTS.LATE_FEE_WAIVED
            ? {
                leaseId: string;
                tenantId: string | null;
                lateFeeScheduleId: string;
                rentScheduleId: string | null;
                amount: string;
                currency: string;
              }
            : E extends typeof DOMAIN_EVENTS.FORMAL_NOTICE_SENT
              ? {
                  leaseId: string;
                  tenantId: string | null;
                  propertyId: string;
                  ownerId: string;
                  documentId: string;
                  totalDue: string;
                  currency: string;
                }
              : E extends typeof DOMAIN_EVENTS.AMENDMENT_CREATED
                ? {
                    leaseId: string;
                    amendmentId: string;
                    version: number;
                    tenantId: string | null;
                    propertyId: string;
                    changes: Record<string, unknown>;
                    effectiveFrom: string;
                  }
                : E extends typeof DOMAIN_EVENTS.AMENDMENT_SIGNED
                  ? {
                      leaseId: string;
                      amendmentId: string;
                      version: number;
                      tenantId: string | null;
                      party: 'TENANT' | 'LANDLORD';
                      bothSigned: boolean;
                    }
                  : E extends typeof DOMAIN_EVENTS.AMENDMENT_APPLIED
                    ? {
                        leaseId: string;
                        amendmentId: string;
                        version: number;
                        tenantId: string | null;
                        propertyId: string;
                        effectiveFrom: string;
                        newMonthlyRent: string;
                        newEndDate: string;
                      }
                    : E extends typeof DOMAIN_EVENTS.LEASE_RENEWED
                      ? {
                          leaseId: string;
                          propertyId: string;
                          tenantId: string | null;
                          previousEndDate: string;
                          newEndDate: string;
                          newMonthlyRent: string;
                          approvalId: string | null;
                        }
                      : E extends typeof DOMAIN_EVENTS.RENT_INDEXATION_PROPOSED
                        ? {
                            leaseId: string;
                            propertyId: string;
                            ownerId: string;
                            anniversary: string;
                            previousMonthlyRent: string;
                            newMonthlyRent: string;
                            currency: string;
                            approvalId: string | null;
                          }
                        : E extends typeof DOMAIN_EVENTS.MANDATE_ACTION_PENDING
                          ? {
                              approvalId: string;
                              mandateId: string;
                              actionType: string;
                            }
                          : E extends typeof DOMAIN_EVENTS.MANDATE_ACTION_DECIDED
                            ? {
                                approvalId: string;
                                mandateId: string;
                                actionType: string;
                                decision: 'APPROVED' | 'REJECTED';
                                decidedBy: string;
                              }
                            : E extends
                                  | typeof DOMAIN_EVENTS.MANDATE_PROPOSED
                                  | typeof DOMAIN_EVENTS.MANDATE_ACCEPTED
                                  | typeof DOMAIN_EVENTS.MANDATE_DECLINED
                                  | typeof DOMAIN_EVENTS.MANDATE_EXPIRING
                              ? {
                                  mandateId: string;
                                  propertyId: string;
                                  organizationId: string;
                                }
                              : E extends typeof DOMAIN_EVENTS.MANDATE_TERMINATED
                                ? {
                                    mandateId: string;
                                    propertyId: string;
                                    organizationId: string;
                                    effectiveAt: string;
                                    reason: string;
                                  }
                                : E extends typeof DOMAIN_EVENTS.EXPENSE_APPROVED
                                  ? { expenseId: string }
                                  : E extends typeof DOMAIN_EVENTS.MANDATE_AGENT_ASSIGNED
                                    ? {
                                        mandateId: string;
                                        agentUserId: string;
                                        assignedBy: string;
                                      }
                                    : E extends typeof DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED
                                      ? {
                                          bookingId: string;
                                          slotId: string;
                                          userId: string;
                                        }
                                      : E extends typeof DOMAIN_EVENTS.VISIT_AGENT_ASSIGNED
                                        ? {
                                            bookingId: string;
                                            agentId: string;
                                            assignedBy: string;
                                          }
                                        : E extends
                                              | typeof DOMAIN_EVENTS.VISIT_BOOKING_COMPLETED
                                              | typeof DOMAIN_EVENTS.VISIT_BOOKING_NO_SHOW
                                              | typeof DOMAIN_EVENTS.VISIT_BOOKING_UNCONFIRMED
                                          ? {
                                              bookingId: string;
                                              slotId: string;
                                              userId: string;
                                              propertyId: string;
                                            }
                                          : E extends typeof DOMAIN_EVENTS.VISIT_BOOKING_CANCELLED
                                            ? {
                                                bookingId: string;
                                                slotId: string;
                                                userId: string;
                                                cancelledById: string;
                                              }
                                            : E extends typeof DOMAIN_EVENTS.VISIT_REMINDER
                                              ? {
                                                  bookingId: string;
                                                  slotId: string;
                                                  userId: string;
                                                  agentId: string | null;
                                                  kind: 'J1' | 'H2';
                                                }
                                              : E extends typeof DOMAIN_EVENTS.MAINTENANCE_OPENED
                                                ? {
                                                    ticketId: string;
                                                    propertyId: string;
                                                    priority: string;
                                                  }
                                                : E extends typeof DOMAIN_EVENTS.RENT_DUE_SOON
                                                  ? {
                                                      rentScheduleId: string;
                                                      dueDate: string;
                                                    }
                                                  : E extends typeof DOMAIN_EVENTS.RENT_OVERDUE
                                                    ? {
                                                        rentScheduleId: string;
                                                        daysOverdue: number;
                                                      }
                                                    : E extends typeof DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED
                                                      ? {
                                                          checkId: string;
                                                          tenantUserId: string;
                                                          requesterOrgId: string;
                                                          organizationName: string;
                                                          /** Spec 04 — set when the check targets a candidature. */
                                                          applicationId?: string;
                                                        }
                                                      : E extends typeof DOMAIN_EVENTS.SOLVENCY_CHECK_DECIDED
                                                        ? {
                                                            checkId: string;
                                                            tenantUserId: string;
                                                            status: string;
                                                            applicationId:
                                                              string | null;
                                                          }
                                                        : E extends typeof DOMAIN_EVENTS.APPLICATION_SUBMITTED
                                                          ? {
                                                              applicationId: string;
                                                              propertyId: string;
                                                              applicantId: string;
                                                              organizationId: string;
                                                              propertyTitle: string;
                                                            }
                                                          : E extends typeof DOMAIN_EVENTS.APPLICATION_ACCEPTED
                                                            ? {
                                                                applicationId: string;
                                                                propertyId: string;
                                                                applicantId: string;
                                                                /** Ids of the sibling applications auto-rejected. */
                                                                autoRejectedIds: string[];
                                                              }
                                                            : E extends typeof DOMAIN_EVENTS.APPLICATION_REJECTED
                                                              ? {
                                                                  applicationId: string;
                                                                  applicantId: string;
                                                                  rejectionMessage:
                                                                    | string
                                                                    | null;
                                                                  /** True when auto-rejected by accepting a sibling. */
                                                                  auto: boolean;
                                                                }
                                                              : E extends typeof DOMAIN_EVENTS.APPLICATION_WITHDRAWN
                                                                ? {
                                                                    applicationId: string;
                                                                    propertyId: string;
                                                                    applicantId: string;
                                                                    organizationId: string;
                                                                  }
                                                                : E extends typeof DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED
                                                                  ? {
                                                                      proofId: string;
                                                                      buyerUserId: string;
                                                                      saleAgreementId: string;
                                                                      requesterOrgId: string;
                                                                      organizationName: string;
                                                                    }
                                                                  : E extends typeof DOMAIN_EVENTS.DEPOSIT_DEDUCTION_PROPOSED
                                                                    ? {
                                                                        leaseId: string;
                                                                        deductionId: string;
                                                                        tenantId:
                                                                          | string
                                                                          | null;
                                                                        label: string;
                                                                        amount: string;
                                                                      }
                                                                    : E extends typeof DOMAIN_EVENTS.DEPOSIT_DEDUCTION_CONTESTED
                                                                      ? {
                                                                          leaseId: string;
                                                                          deductionId: string;
                                                                          tenantId:
                                                                            | string
                                                                            | null;
                                                                          label: string;
                                                                          amount: string;
                                                                          comment:
                                                                            | string
                                                                            | null;
                                                                        }
                                                                      : E extends typeof DOMAIN_EVENTS.DEPOSIT_SETTLED
                                                                        ? {
                                                                            leaseId: string;
                                                                            settlementId: string;
                                                                            tenantId:
                                                                              | string
                                                                              | null;
                                                                            deducted: string;
                                                                            refundAmount: string;
                                                                            currency: string;
                                                                            payoutId:
                                                                              | string
                                                                              | null;
                                                                          }
                                                                        : E extends typeof DOMAIN_EVENTS.DEPOSIT_REFUND_DUE
                                                                          ? {
                                                                              leaseId: string;
                                                                              tenantId:
                                                                                | string
                                                                                | null;
                                                                              refundDeadline: string;
                                                                              ownerId: string;
                                                                            }
                                                                          : E extends
                                                                                | typeof DOMAIN_EVENTS.PAYMENT_FAILED
                                                                                | typeof DOMAIN_EVENTS.PAYMENT_EXPIRED
                                                                            ? {
                                                                                paymentId: string;
                                                                                userId: string;
                                                                                amount: string;
                                                                                currency: string;
                                                                                reason:
                                                                                  | string
                                                                                  | null;
                                                                              }
                                                                            : E extends typeof DOMAIN_EVENTS.PAYMENT_DISPUTED
                                                                              ? {
                                                                                  paymentId: string;
                                                                                  disputeId: string;
                                                                                  openedBy: string;
                                                                                  reason: string;
                                                                                }
                                                                              : E extends typeof DOMAIN_EVENTS.PAYMENT_REFUNDED
                                                                                ? {
                                                                                    paymentId: string;
                                                                                    refundId: string;
                                                                                    amount: string;
                                                                                    currency: string;
                                                                                  }
                                                                                : E extends
                                                                                      | typeof DOMAIN_EVENTS.PAYOUT_PAID
                                                                                      | typeof DOMAIN_EVENTS.PAYOUT_FAILED
                                                                                  ? {
                                                                                      payoutId: string;
                                                                                      organizationId: string;
                                                                                      amount: string;
                                                                                      currency: string;
                                                                                      reason:
                                                                                        | string
                                                                                        | null;
                                                                                    }
                                                                                  : E extends
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_HELD
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_HOLD_EXPIRED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_REQUESTED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_CANCELLED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_ACCEPTED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_DECLINED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_EXPIRED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_CONFIRMED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_CHECKED_IN
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_CHECKED_OUT
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_COMPLETED
                                                                                        | typeof DOMAIN_EVENTS.BOOKING_DAMAGE_REPORTED
                                                                                    ? {
                                                                                        bookingId: string;
                                                                                        userId: string;
                                                                                        propertyId?: string;
                                                                                        holdExpiresAt?: string;
                                                                                        refundPercent?: number;
                                                                                        refundAmount?: string;
                                                                                        reason?:
                                                                                          | string
                                                                                          | null;
                                                                                        reportId?: string;
                                                                                        amount?: string;
                                                                                      }
                                                                                    : E extends typeof DOMAIN_EVENTS.SALE_INQUIRY_CREATED
                                                                                      ? {
                                                                                          inquiryId: string;
                                                                                          propertyId: string;
                                                                                          buyerUserId: string;
                                                                                        }
                                                                                      : E extends
                                                                                            | typeof DOMAIN_EVENTS.SALE_OFFER_SUBMITTED
                                                                                            | typeof DOMAIN_EVENTS.SALE_OFFER_DECIDED
                                                                                            | typeof DOMAIN_EVENTS.SALE_OFFER_FORWARDED
                                                                                        ? {
                                                                                            offerId: string;
                                                                                            propertyId: string;
                                                                                            buyerId: string;
                                                                                            price: string;
                                                                                            decision?: string;
                                                                                          }
                                                                                        : Record<
                                                                                            string,
                                                                                            unknown
                                                                                          >;
