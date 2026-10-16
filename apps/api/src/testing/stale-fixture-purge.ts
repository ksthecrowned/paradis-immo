/**
 * Self-healing purge for spec fixtures.
 *
 * Specs delete their users in `beforeAll` so a crashed previous run doesn't
 * block re-runs with unique-constraint violations. But user deletion is
 * blocked by FKs (UserRole, Notification, Payment, owned Property with its
 * lease tree, org memberships…), and the purge order varies per spec —
 * leftovers used to poison unrelated suites.
 *
 * This helper deletes everything a spec's fixture rows can reference, in
 * dependency order. Each step is best-effort so one missing model or row
 * doesn't abort the purge; the final user deletion is NOT caught, because a
 * failure there must surface (the spec cannot run without it).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function safe(db: Db, model: string, where: unknown): Promise<void> {
  try {
    await db[model].deleteMany({ where });
  } catch {
    // Model not present in this schema version, or no rows — irrelevant.
  }
}

export interface StaleFixture {
  /** Phones of the users this spec owns. */
  phones: string[];
  /** Prefixes of organizations this spec owns (e.g. 'Spec02 Immo'). */
  orgPrefixes?: string[];
}

export async function purgeStaleFixture(
  db: Db,
  fixture: StaleFixture,
): Promise<void> {
  const users = await db.user.findMany({
    where: { phone: { in: fixture.phones } },
    select: { id: true },
  });
  const userIds: string[] = users.map((u: { id: string }) => u.id);

  const orgs = fixture.orgPrefixes?.length
    ? await db.organization.findMany({
        where: {
          OR: fixture.orgPrefixes.map((p) => ({ name: { startsWith: p } })),
        },
        select: { id: true },
      })
    : [];
  const orgIds: string[] = orgs.map((o: { id: string }) => o.id);

  if (userIds.length === 0 && orgIds.length === 0) return;

  const props = await db.property.findMany({
    where: {
      OR: [
        ...(userIds.length ? [{ ownerId: { in: userIds } }] : []),
        ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const propIds: string[] = props.map((x: { id: string }) => x.id);
  const leases = propIds.length
    ? await db.lease.findMany({
        where: { propertyId: { in: propIds } },
        select: { id: true },
      })
    : [];
  const leaseIds: string[] = leases.map((l: { id: string }) => l.id);
  const scheduleIds: string[] = leaseIds.length
    ? (
        await db.rentSchedule.findMany({
          where: { leaseId: { in: leaseIds } },
          select: { id: true },
        })
      ).map((s: { id: string }) => s.id)
    : [];

  // Payments reachable from the fixture (owned by stale users or allocated
  // to their rent schedules).
  const payments = await db.payment.findMany({
    where: {
      OR: [
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
        ...(scheduleIds.length
          ? [{ allocations: { some: { rentScheduleId: { in: scheduleIds } } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  const payIds: string[] = payments.map((x: { id: string }) => x.id);
  if (payIds.length) {
    await safe(db, 'receipt', { paymentId: { in: payIds } });
    await safe(db, 'paymentEvent', { paymentId: { in: payIds } });
    await safe(db, 'refund', { paymentId: { in: payIds } });
    await safe(db, 'paymentDispute', { paymentId: { in: payIds } });
    await safe(db, 'paymentAllocation', { paymentId: { in: payIds } });
    await safe(db, 'payment', { id: { in: payIds } });
  }
  if (scheduleIds.length)
    await safe(db, 'rentReceipt', { rentScheduleId: { in: scheduleIds } });

  // Lease tree.
  if (leaseIds.length) {
    await safe(db, 'rentSchedule', { leaseId: { in: leaseIds } });
    await safe(db, 'leaseAmendment', { leaseId: { in: leaseIds } });
    await safe(db, 'leaseDocument', { leaseId: { in: leaseIds } });
    await safe(db, 'leaseTenant', { leaseId: { in: leaseIds } });
    await safe(db, 'inspection', { leaseId: { in: leaseIds } });
    await safe(db, 'depositDeduction', { leaseId: { in: leaseIds } });
    await safe(db, 'depositSettlement', { leaseId: { in: leaseIds } });
    await safe(db, 'lease', { id: { in: leaseIds } });
  }

  // Property tree.
  if (propIds.length) {
    await safe(db, 'rentalApplication', { propertyId: { in: propIds } });
    await safe(db, 'ledgerEntry', { propertyId: { in: propIds } });
    await safe(db, 'expense', { propertyId: { in: propIds } });
    const mandateIds: string[] = (
      await db.mandate.findMany({
        where: { propertyId: { in: propIds } },
        select: { id: true },
      })
    ).map((m: { id: string }) => m.id);
    if (mandateIds.length) {
      await safe(db, 'mandateApproval', { mandateId: { in: mandateIds } });
      await safe(db, 'mandateVersion', { mandateId: { in: mandateIds } });
      await safe(db, 'mandate', { id: { in: mandateIds } });
    }
    await safe(db, 'visitBooking', { slot: { propertyId: { in: propIds } } });
    await safe(db, 'visitSlot', { propertyId: { in: propIds } });
    await safe(db, 'visitSlotTemplate', { propertyId: { in: propIds } });
    await safe(db, 'booking', { propertyId: { in: propIds } });
    await safe(db, 'availabilityBlock', { propertyId: { in: propIds } });
    await safe(db, 'favorite', { propertyId: { in: propIds } });
    await safe(db, 'propertyView', { propertyId: { in: propIds } });
    await safe(db, 'propertyReport', { propertyId: { in: propIds } });
    await safe(db, 'propertyMedia', { propertyId: { in: propIds } });
    await safe(db, 'propertyDocument', { propertyId: { in: propIds } });
    await safe(db, 'saleInquiry', { propertyId: { in: propIds } });
    await safe(db, 'saleAgreement', { propertyId: { in: propIds } });
    await safe(db, 'maintenanceTicket', { propertyId: { in: propIds } });
    await safe(db, 'property', { id: { in: propIds } });
  }

  // Organization tree.
  if (orgIds.length) {
    await safe(db, 'documentSequence', { organizationId: { in: orgIds } });
    await safe(db, 'payout', { organizationId: { in: orgIds } });
    await safe(db, 'payoutAccount', { organizationId: { in: orgIds } });
    await safe(db, 'organizationMember', { organizationId: { in: orgIds } });
    await safe(db, 'organizationInvitation', {
      organizationId: { in: orgIds },
    });
    await safe(db, 'organizationReview', { organizationId: { in: orgIds } });
    await safe(db, 'organizationServiceArea', {
      organizationId: { in: orgIds },
    });
    await safe(db, 'organizationRequest', { organizationId: { in: orgIds } });
    await safe(db, 'organization', { id: { in: orgIds } });
  }

  // Users last — these two must succeed or the spec cannot start.
  if (userIds.length) {
    await safe(db, 'notification', { userId: { in: userIds } });
    await safe(db, 'refreshToken', { userId: { in: userIds } });
    await safe(db, 'otpChallenge', { userId: { in: userIds } });
    await safe(db, 'userPhoneHistory', { userId: { in: userIds } });
    await safe(db, 'kycSubmission', { userId: { in: userIds } });
    await safe(db, 'organizationMember', { userId: { in: userIds } });
    await db.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
