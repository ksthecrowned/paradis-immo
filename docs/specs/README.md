# Specs fonctionnelles — Paradis Immo

Specs des fonctionnalités à ajouter à la plateforme (API `apps/api`, dashboards `apps/web`, app `apps/mobile`).
Elles s'appuient sur un audit du code au 2026-10 et ne contiennent aucun code applicatif, seulement des contrats : règles, modèle de données, endpoints, écrans et critères d'acceptation.

## Index

| # | Fichier | Domaine |
|---|---------|---------|
| 01 | [01-compte-securite-conformite.md](01-compte-securite-conformite.md) | Sessions, compte, téléphone, suppression, RGPD/KYC, sécurité transverse |
| 02 | [02-organisations-equipes.md](02-organisations-equipes.md) | Création d'agence, affiliation, invitations, membres, avis |
| 03 | [03-gerance-mandats-comptabilite.md](03-gerance-mandats-comptabilite.md) | Cycle de vie du mandat, approbations, commissions, comptabilité propriétaire |
| 04 | [04-bail-caution-etats-des-lieux.md](04-bail-caution-etats-des-lieux.md) | Candidature, bail, résiliation, renouvellement, caution, états des lieux, quittances |
| 05 | [05-paiements-remboursements-reversements.md](05-paiements-remboursements-reversements.md) | Mobile money réel, contrôle des montants, litiges, remboursements, reversements |
| 06 | [06-visites.md](06-visites.md) | Créneaux, hold, reprogrammation, clôture COMPLETED/NO_SHOW, rappels |
| 07 | [07-sejours-courte-duree.md](07-sejours-courte-duree.md) | Réservation avec hold, paiement, annulation, politique, frais, check-in |
| 08 | [08-vente.md](08-vente.md) | Demandes, offres et contre-offres, compromis, statut du bien |
| 09 | [09-maintenance.md](09-maintenance.md) | Machine à états, prestataires, commentaires/photos, coûts, approbations |
| 10 | [10-messagerie.md](10-messagerie.md) | Conversations in-app entre chercheur, locataire, agence, propriétaire |
| 11 | [11-notifications.md](11-notifications.md) | Handlers d'événements, templates, multi-appareils, préférences, retry |
| 12 | [12-admin-back-office.md](12-admin-back-office.md) | Utilisateurs, organisations, paiements, modération, audit log, configuration |
| 13 | [13-recherche-annonces.md](13-recherche-annonces.md) | Filtres, recherche texte et géo, tri, alertes, documents du bien |
| 14 | [14-mobile-transverse.md](14-mobile-transverse.md) | Corrections des écrans factices, stockage sécurisé, deep links, offline, espace gestionnaire |

## Conventions

- **Priorités.**
  - **P0** : bug, faille ou flux cassé ; à faire avant toute mise en production réelle.
  - **P1** : fonctionnalité attendue d'une plateforme de gestion complète.
  - **P2** : confort ou différenciation.
- **Rôles.**
  - `SEEKER` : visiteur ou chercheur connecté, sans bail.
  - `TENANT` : titulaire d'un bail ACTIVE.
  - `GUEST` : client d'un séjour courte durée.
  - `BUYER`.
  - `OWNER` : propriétaire, membre OWNER d'une org de type OWNER.
  - `MANAGER` : membre ADMIN d'une agence.
  - `AGENT` : membre AGENT d'une agence.
  - `PROVIDER` : prestataire de maintenance, nouveau rôle.
  - `PLATFORM_ADMIN`.
- **Accès gestionnaire.** Il passe toujours par `AgencyAccessService` (propriétaire, gérant de l'agence mandatée, agent assigné, ou membre de l'org d'un bien sans mandat). Toute liste « managed » doit utiliser ce même périmètre, et non la seule appartenance à l'org du bien (incohérence relevée dans bookings, maintenance et sales).
- **Endpoints.** Préfixe `api/v1`. Pagination standard `?limit=&offset=` avec réponse `{ data, meta: { total, limit, offset } }`, comme dans `properties`.
- **Événements.** Chaque transition métier émet un `DOMAIN_EVENTS.*`. Une spec qui ajoute un événement doit aussi ajouter son handler de notification (voir 11).
- **Montants.** `Decimal` en XAF, sans centimes. La devise est portée par l'objet.
- **Dates.** Stockage en UTC. Affichage et crons en `Africa/Brazzaville`.

## Constats transverses (P0)

À traiter en priorité, quel que soit le domaine :

1. `OrganizationsService.ensureAgentMembership` rend n'importe quel utilisateur AGENT de Paradis Immo, ce qui ouvre une escalade de privilèges (01, 02).
2. `GET properties/:id/documents` n'a aucun guard : titres fonciers et plans sont publics (13).
3. `GET users/lookup` permet d'énumérer les comptes par numéro de téléphone (01).
4. `initiatePayment` accepte un montant fourni par le client, ne le compare pas à l'échéance et ne vérifie pas que le payeur est le locataire (05).
5. `MobileMoneyProvider` est un stub : aucun paiement mobile money réel n'est possible (05).
6. Seuls 4 handlers `@OnEvent` existent (3 notifications + reçu). `LEASE_CREATED`, `MANDATE_ACTION_PENDING`, `VISIT_BOOKING_CONFIRMED`, `MAINTENANCE_OPENED` et `PAYMENT_INITIATED` sont émis sans que personne ne les écoute (11).
7. `NotificationsService.markFailed` ne passe pas le statut à `FAILED` (11).
8. Les séjours sont créés `CONFIRMED` avant paiement, et le contrôle de chevauchement se fait hors transaction (07).
9. Vente : `complete()` ne passe pas le bien en `SOLD`, et `cancel()` ne remet pas `UNDER_OFFER` en `AVAILABLE` (08).
10. Mobile : `sale-inquiry.tsx` simule l'envoi avec `setTimeout` ; le checkout de séjour ne reçoit pas de `bookingId` ; les tokens sont stockés dans AsyncStorage (14).
