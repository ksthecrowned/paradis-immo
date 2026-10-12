import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, SaleOfferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { SaleOffersService } from './sale-offers.service';

/**
 * Spec 08 P1 — flux d'offres et contre-offres, sur une base de dev réelle
 * (mêmes fixtures que sales.spec) :
 * - création par l'acheteur → SUBMITTED ;
 * - refus des non-autorisés ;
 * - acceptation → ACCEPTED + listingStatus UNDER_OFFER + offres ouvertes
 *   concurrentes rejetées automatiquement ;
 * - contre-offre : l'offre parente passe COUNTERED, l'enfant est SUBMITTED ;
 * - retrait par l'acheteur.
 */
describe('SaleOffersService (spec 08 P1)', () => {
  let offers: SaleOffersService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let buyerAId: string;
  let buyerBId: string;
  let salePropertyId: string;
  // Second bien de fixture : le scénario contre-offre reste isolé du cycle
  // « accepté » du premier bien (une seule offre ACCEPTED par bien).
  let saleProperty2Id: string;
  // Passe négative agence : bien sous mandat SANS scope SALE (gérant/agent
  // de l'agence bloqués) et bien sous mandat scope SALE (membre désactivé
  // bloqué, agent actif autorisé en contrôle positif).
  let mandateNoSalePropertyId: string;
  let mandateSalePropertyId: string;
  let agencyOrgId: string;
  let agencyGerantId: string;
  let unassignedAgentId: string;
  let disabledAgentId: string;
  let activeAgentId: string;
  const createdOfferIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SaleOffersService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    offers = moduleRef.get(SaleOffersService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    const phones = [
      '+242078888801',
      '+242078888802',
      '+242078888803',
      '+242078888804',
      '+242078888805',
      '+242078888806',
      '+242078888807',
      '+242078888808',
    ];
    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.saleOffer
        .deleteMany({ where: { buyerId: { in: staleIds } } })
        .catch(() => undefined);
      await prisma.saleInquiry
        .deleteMany({ where: { userId: { in: staleIds } } })
        .catch(() => undefined);
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: '+242078888801',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    buyerAId = (
      await prisma.user.create({
        data: {
          phone: '+242078888802',
          countryId,
          name: 'Acheteur A',
          roles: { create: { role: 'TENANT' } },
        },
      })
    ).id;
    buyerBId = (
      await prisma.user.create({
        data: {
          phone: '+242078888803',
          countryId,
          name: 'Acheteur B',
          roles: { create: { role: 'TENANT' } },
        },
      })
    ).id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Sale Offers Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const saleProp = await prisma.property.create({
      data: {
        title: 'Sale Offers Test Property',
        description: 'Villa offres',
        type: 'HOUSE',
        mode: 'SALE',
        price: 60_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    salePropertyId = saleProp.id;
    const saleProp2 = await prisma.property.create({
      data: {
        title: 'Sale Offers Test Property 2',
        description: 'Villa offres cycle 2',
        type: 'HOUSE',
        mode: 'SALE',
        price: 70_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    saleProperty2Id = saleProp2.id;

    // ---- Fixtures passe négative agence (gérant / agent / membre désactivé)
    const [gerant, disabledAgent, activeAgent, unassignedAgent] = await Promise.all([
      prisma.user.create({
        data: {
          phone: '+242078888805',
          countryId,
          name: 'Gérant agence',
          roles: { create: { role: 'TENANT' } },
        },
      }),
      prisma.user.create({
        data: {
          phone: '+242078888806',
          countryId,
          name: 'Agent désactivé',
          roles: { create: { role: 'TENANT' } },
        },
      }),
      prisma.user.create({
        data: {
          phone: '+242078888807',
          countryId,
          name: 'Agent actif',
          roles: { create: { role: 'TENANT' } },
        },
      }),
      prisma.user.create({
        data: {
          phone: '+242078888808',
          countryId,
          name: 'Agent non assigné',
          roles: { create: { role: 'TENANT' } },
        },
      }),
    ]);
    agencyGerantId = gerant.id;
    disabledAgentId = disabledAgent.id;
    activeAgentId = activeAgent.id;
    unassignedAgentId = unassignedAgent.id;

    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Sale Offers Agency ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: {
          create: [
            { userId: agencyGerantId, role: 'ADMIN', status: 'ACTIVE' },
            { userId: activeAgentId, role: 'AGENT', status: 'ACTIVE' },
            { userId: unassignedAgentId, role: 'AGENT', status: 'ACTIVE' },
            { userId: disabledAgentId, role: 'AGENT', status: 'DISABLED' },
          ],
        },
      },
    });
    agencyOrgId = agencyOrg.id;

    // Bien sous mandat agence SANS scope SALE : le gérant actif et l'agent
    // ne doivent NI lire NI muter les offres (lecture partagée limitée).
    const prop3 = await prisma.property.create({
      data: {
        title: 'Sale Offers Test Property 3',
        description: 'Villa mandat sans scope vente',
        type: 'HOUSE',
        mode: 'SALE',
        price: 80_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: agencyOrg.id,
      },
    });
    mandateNoSalePropertyId = prop3.id;
    await prisma.mandate.create({
      data: {
        propertyId: prop3.id,
        organizationId: agencyOrg.id,
        status: 'ACTIVE',
        scopes: ['LONG_TERM_RENTAL'],
        assignedAgentId: agencyGerantId,
        proposedById: ownerUserId,
      },
    });

    // Bien sous mandat agence AVEC scope SALE assigné à l'agent actif :
    // l'agent actif peut agir (contrôle positif), le membre désactivé non.
    const prop4 = await prisma.property.create({
      data: {
        title: 'Sale Offers Test Property 4',
        description: 'Villa mandat scope vente',
        type: 'HOUSE',
        mode: 'SALE',
        price: 90_000_000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: agencyOrg.id,
      },
    });
    mandateSalePropertyId = prop4.id;
    await prisma.mandate.create({
      data: {
        propertyId: prop4.id,
        organizationId: agencyOrg.id,
        status: 'ACTIVE',
        scopes: ['SALE'],
        assignedAgentId: activeAgentId,
        proposedById: ownerUserId,
      },
    });
  });

  afterAll(async () => {
    if (createdOfferIds.length) {
      await prisma.saleOffer
        .deleteMany({ where: { id: { in: createdOfferIds } } })
        .catch(() => undefined);
      // Child offers created by counters reference removed parents; delete all
      // offers on the fixture property to be safe.
      await prisma.saleOffer
        .deleteMany({ where: { propertyId: salePropertyId } })
        .catch(() => undefined);
    }
    if (agencyOrgId) {
      await prisma.mandate
        .deleteMany({ where: { organizationId: agencyOrgId } })
        .catch(() => undefined);
      await prisma.organizationMember
        .deleteMany({ where: { organizationId: agencyOrgId } })
        .catch(() => undefined);
      await prisma.organization
        .deleteMany({ where: { id: agencyOrgId } })
        .catch(() => undefined);
    }
    if (salePropertyId) {
      await prisma.saleInquiry
        .deleteMany({
          where: {
            propertyId: {
              in: [salePropertyId, saleProperty2Id, mandateNoSalePropertyId, mandateSalePropertyId],
            },
          },
        })
        .catch(() => undefined);
      await prisma.mandate
        .deleteMany({
          where: {
            propertyId: { in: [mandateNoSalePropertyId, mandateSalePropertyId] },
          },
        })
        .catch(() => undefined);
      await prisma.property
        .deleteMany({
          where: {
            id: { in: [salePropertyId, saleProperty2Id, mandateNoSalePropertyId, mandateSalePropertyId] },
          },
        })
        .catch(() => undefined);
    }
    await prisma.organizationMember
      .deleteMany({
        where: {
          userId: {
            in: [
              ownerUserId,
              buyerAId,
              buyerBId,
              agencyGerantId,
              disabledAgentId,
              activeAgentId,
              unassignedAgentId,
            ],
          },
        },
      })
      .catch(() => undefined);
    await prisma.userRole
      .deleteMany({
        where: {
          userId: {
            in: [
              ownerUserId,
              buyerAId,
              buyerBId,
              agencyGerantId,
              disabledAgentId,
              activeAgentId,
              unassignedAgentId,
            ],
          },
        },
      })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          id: {
            in: [
              ownerUserId,
              buyerAId,
              buyerBId,
              agencyGerantId,
              disabledAgentId,
              activeAgentId,
              unassignedAgentId,
            ],
          },
        },
      })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('acheteur A crée une offre → SUBMITTED', async () => {
    const offer = await offers.createForProperty(salePropertyId, buyerAId, {
      price: 55_000_000,
      financing: 'INSTALLMENTS',
      depositAmount: 5_000_000,
      installmentsCount: 10,
      conditions: 'Signature sous 30 jours',
    });
    createdOfferIds.push(offer.id);

    expect(offer.status).toBe(SaleOfferStatus.SUBMITTED);
    expect(offer.authorSide).toBe('BUYER');
    expect(offer.buyerId).toBe(buyerAId);
    expect(offer.inquiryId).toBeNull(); // pas de demande ouverte préalable
  });

  it('un tiers non autorisé ne peut pas accepter, refuser ni transmettre', async () => {
    const offer = createdOfferIds[0];
    await expect(offers.accept(offer, buyerBId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(offers.reject(offer, buyerBId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(offers.forward(offer, buyerBId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("l'acheteur ne peut pas accepter sa propre offre BUYER", async () => {
    await expect(
      offers.accept(createdOfferIds[0], buyerAId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('le propriétaire accepte → UNDER_OFFER, concurrentes rejetées', async () => {
    // Acheteur B pose une offre concurrente pendant que A est ouverte.
    const offerB = await offers.createForProperty(salePropertyId, buyerBId, {
      price: 58_000_000,
      financing: 'CASH',
    });
    createdOfferIds.push(offerB.id);

    const accepted = await offers.accept(createdOfferIds[0], ownerUserId);
    expect(accepted.status).toBe(SaleOfferStatus.ACCEPTED);
    expect(accepted.decidedById).toBe(ownerUserId);

    // Le bien passe UNDER_OFFER.
    const prop = await prisma.property.findUnique({
      where: { id: salePropertyId },
      select: { listingStatus: true },
    });
    expect(prop?.listingStatus).toBe(ListingStatus.UNDER_OFFER);

    // Offre concurrente rejetée automatiquement.
    const offerBAfter = await prisma.saleOffer.findUnique({
      where: { id: offerB.id },
      select: { status: true, decisionNote: true },
    });
    expect(offerBAfter?.status).toBe(SaleOfferStatus.REJECTED);
    expect(offerBAfter?.decisionNote).toContain('concurrente');
  });

  it('une seconde acceptation sur le bien est refusée (déjà UNDER_OFFER)', async () => {
    // L'offre B a déjà été auto-rejetée ; on rejoue l'acceptation de B →
    // not decidable.
    const offerB = createdOfferIds[1];
    await expect(offers.accept(offerB, ownerUserId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('contre-offre côté vente : parent COUNTERED, enfant SUBMITTED', async () => {
    // Bien propre pour ce scénario (l'offre du 1ᵉʳ bien reste ACCEPTED).
    const offer = await offers.createForProperty(
      saleProperty2Id,
      buyerAId,
      {
      price: 50_000_000,
      financing: 'CASH',
    });
    createdOfferIds.push(offer.id);

    const countered = await offers.counter(offer.id, ownerUserId, {
      price: 57_000_000,
      financing: 'CASH',
    });
    createdOfferIds.push(countered.id);

    expect(countered.status).toBe(SaleOfferStatus.SUBMITTED);
    expect(countered.authorSide).toBe('SELLER');
    expect(countered.parentOfferId).toBe(offer.id);

    const parent = await prisma.saleOffer.findUnique({
      where: { id: offer.id },
      select: { status: true },
    });
    expect(parent?.status).toBe(SaleOfferStatus.COUNTERED);

    // L'acheteur accepte la contre-offre du vendeur.
    const acceptedByBuyer = await offers.accept(countered.id, buyerAId);
    expect(acceptedByBuyer.status).toBe(SaleOfferStatus.ACCEPTED);

    const prop2 = await prisma.property.findUnique({
      where: { id: saleProperty2Id },
      select: { listingStatus: true },
    });
    expect(prop2?.listingStatus).toBe(ListingStatus.UNDER_OFFER);
  });

  it("l'acheteur retire son offre ouverte → WITHDRAWN", async () => {
    const offer = await offers.createForProperty(salePropertyId, buyerBId, {
      price: 54_000_000,
      financing: 'BANK_LOAN',
    });
    createdOfferIds.push(offer.id);
    const withdrawn = await offers.withdraw(offer.id, buyerBId);
    expect(withdrawn.status).toBe(SaleOfferStatus.WITHDRAWN);

    // Un tiers ne peut pas retirer l'offre d'autrui.
    const other = await offers.createForProperty(salePropertyId, buyerAId, {
      price: 59_000_000,
      financing: 'CASH',
    });
    createdOfferIds.push(other.id);
    await expect(offers.withdraw(other.id, buyerBId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // ---- Passe négative agence (audit négatif téléphone/lecture partagée) ----

  it('mandat SANS scope SALE : agent non assigné ni lit ni mute les offres', async () => {
    // Bien sous mandat RENTAL sans scope SALE. Conformément à la spec 08,
    // le gérant (ADMIN) de l'org du bien garde le périmètre vente ; mais un
    // agent AGENT actif non assigné au mandat n'a aucun droit vente.
    const offer = await offers.createForProperty(
      mandateNoSalePropertyId,
      buyerBId,
      { price: 20_000_000, financing: 'CASH' },
    );
    createdOfferIds.push(offer.id);

    await expect(
      offers.getOne(offer.id, unassignedAgentId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      offers.forward(offer.id, unassignedAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      offers.accept(offer.id, unassignedAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      offers.counter(offer.id, unassignedAgentId, {
        price: 21_000_000,
        financing: 'CASH',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // L'agent désactivé est bloqué même en lecture.
    await expect(
      offers.getOne(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      offers.forward(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mandat scope SALE : membre désactivé bloqué, agent actif autorisé', async () => {
    const offer = await offers.createForProperty(
      mandateSalePropertyId,
      buyerBId,
      { price: 30_000_000, financing: 'CASH' },
    );
    createdOfferIds.push(offer.id);

    // Membre AGENT désactivé de l'org mandatée : ni lecture ni mutation,
    // y compris sur un mandat scope SALE où l'agent serait autorisé.
    await expect(
      offers.getOne(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      offers.accept(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      offers.forward(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Contrôle positif : l'agent actif assigné peut transmettre (sinon le
    // refus ci-dessus ne prouverait rien sur la chaîne mandat/membership).
    const forwarded = await offers.forward(offer.id, activeAgentId);
    expect(forwarded.status).toBe(SaleOfferStatus.FORWARDED);

    // Et après transmission, l'agent désactivé reste bloqué.
    await expect(
      offers.accept(offer.id, disabledAgentId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
