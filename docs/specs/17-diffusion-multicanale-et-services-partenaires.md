# 17 — Diffusion multicanale et services partenaires

## Objectif et statut

Permettre à une agence d'utiliser Paradis Immo comme outil de gestion tout en choisissant où diffuser ses annonces :

- marketplace Paradis Immo (site public et application mobile client) ;
- site web propre à l'agence ;
- application mobile propre à l'agence ;
- autres intégrations partenaires autorisées.

Paradis Immo fournit aux intégrations externes un accès dédié aux annonces publiques de l'agence et à leurs changements, sans exposer l'API interne ni les données privées de gestion. Des partenaires, dont des développeurs indépendants, peuvent proposer la conception et le développement de sites ou d'applications personnalisés s'appuyant sur cette intégration.

Cette spec décrit la cible fonctionnelle. Elle ne confirme pas que l'API partenaires, les connecteurs, les contrats ou les services de développement sont déjà disponibles.

## Principes produit

1. **Canaux indépendants** : activer un canal externe ne désactive pas la marketplace Paradis Immo, et inversement. L'agence peut utiliser un ou plusieurs canaux en parallèle.
2. **Réglage agence + choix par bien** : l'agence définit ses canaux par défaut ; chaque bien peut les remplacer. Le choix par bien est explicite et visible dans la fiche.
3. **Source unique de vérité** : les informations métier du bien sont gérées dans Paradis Immo. Les systèmes externes consomment une projection publique et n'écrivent pas directement dans les données internes.
4. **Droits indépendants** : diffuser une annonce ne prouve pas que l'agence possède le bien et ne vaut ni mandat, ni consentement, ni vérification documentaire. Les règles de publication/modération et de mandat des specs 03, 12, 13 et 16 restent applicables.
5. **Retrait cohérent** : un bien désactivé, vendu, occupé, modéré, retiré d'un canal ou dont le mandat est refusé/révoqué ne doit pas continuer à être présenté comme disponible sur une intégration externe après le délai de propagation défini. Les décisions `DECLINED`, `REJECTED` et `NEEDS_CORRECTION`, ainsi que la pause/retrait du bien, suivent les transitions canoniques de la spec 03.
6. **Leads attribuables** : toute demande reçue depuis un canal porte sa source et son intégration d'origine. La politique de routage est configurée par l'agence, et respecte les autorisations et préférences applicables.
7. **Pas de dépendance obligatoire à un partenaire** : l'agence peut utiliser une API documentée avec son propre prestataire ou équipe technique. Le service de conception/développement personnalisé est une offre distincte.

## Rôles

- **ADMIN d'agence** : configure les canaux, crée/révèle/révoque les identifiants d'intégration, autorise un site/app partenaire, voit les statistiques de diffusion et définit le routage des demandes.
- **AGENT d'agence** : voit les canaux d'un bien et peut en modifier les réglages si la permission de gestion du bien le permet ; ne peut pas créer ou administrer les intégrations.
- **PLATFORM_ADMIN** : administre l'offre API, les intégrations/partenaires selon ses permissions, les quotas globaux et les incidents. Ne modifie pas les annonces de l'agence sans autorisation admin distincte.
- **Partenaire technique** : accès strictement limité à une intégration explicitement autorisée par une agence ; aucun accès à l'espace de gestion ni aux ressources d'autres organisations.
- **Visiteur/chercheur** : consulte les annonces publiques selon les règles du canal et adresse une demande par le parcours disponible.

## User stories

1. En tant qu'admin agence, je choisis d'afficher ou non mes biens sur la marketplace Paradis Immo, indépendamment de leur diffusion sur mes canaux externes.
2. En tant qu'admin agence, je peux autoriser plusieurs sites/applications externes et révoquer chacun sans désactiver les autres canaux.
3. En tant qu'admin agence, je choisis un canal par défaut et peux activer/désactiver chaque canal sur un bien donné.
4. En tant qu'agent autorisé à gérer un bien, je peux voir où il est diffusé et le canal d'origine des demandes qui lui sont liées.
5. En tant que visiteur d'un site partenaire, je consulte uniquement les champs et médias publics d'une annonce publiée sur ce canal.
6. En tant qu'intégration partenaire, je récupère les annonces autorisées et leurs changements de statut, sans interroger la base ou les endpoints internes de Paradis Immo.
7. En tant qu'agence, je choisis si les demandes d'un canal sont reçues dans Paradis Immo, transmises à une destination approuvée de l'agence, ou les deux.
8. En tant qu'agence, je mesure les annonces et demandes par canal, avec une définition claire des vues, contacts et périodes.
9. En tant que partenaire développeur, je peux consulter la documentation publique, demander un accès de test et obtenir l'autorisation d'une agence avant tout accès à ses données.
10. En tant qu'agence, je peux commander à un partenaire la conception, le développement, l'hébergement ou la maintenance d'un site ou d'une application personnalisés selon une offre séparée.

## Définitions

- **Canal** : destination de diffusion, par exemple `PARADIS_MARKETPLACE`, `AGENCY_WEBSITE`, `AGENCY_APP` ou `PARTNER`.
- **Intégration** : connexion technique nommée et révocable entre une organisation agence et une application/site.
- **Projection publique** : liste explicite des champs diffusables ; elle ne reprend jamais automatiquement le modèle complet de `Property`.
- **Événement de synchronisation** : changement de projection qu'une intégration peut récupérer ou recevoir afin de synchroniser son catalogue.
- **Lead** : demande générée par un visiteur via un canal. Sa source est persistée et reste disponible dans le portail de gestion.
- **Partenaire de réalisation** : fournisseur choisi par l'agence pour concevoir ou maintenir un site/app ; il n'obtient aucun droit API implicite du seul fait de cette relation commerciale.

## Règles métier

### Canaux et visibilité

- La configuration d'agence contient un état d'activation par canal, des valeurs par défaut et des destinations/règles de routage autorisées.
- La configuration d'un bien peut hériter des valeurs agence ou les remplacer canal par canal.
- Un canal externe ne peut diffuser que les annonces satisfaisant les critères de visibilité publique de la spec 13 : statut publiable, modération approuvée, statut marketplace éligible, organisation non suspendue et autorisations de diffusion présentes.
- La liste réellement exportée est toujours filtrée côté serveur. Un partenaire ne peut pas imposer un `propertyId`, statut ou `organizationId` pour élargir son périmètre.
- Les champs privés sont exclus par défaut : identifiants internes non nécessaires, coordonnées propriétaires/locataires, adresse exacte si masquée sur le canal public, documents privés, informations de mandat, notes, analytics sensibles et données de paiement.
- Le contenu peut être adapté par canal uniquement via des champs éditoriaux contrôlés (ex. titre/description spécifique), si cette capacité est ajoutée au modèle ; sinon, le contenu source est identique.
- Une annonce en pause, retirée, vendue, occupée, masquée par modération ou non autorisée doit être retirée de la réponse de catalogue et signalée comme retirée dans le flux de synchronisation. Les intégrations doivent traiter l'événement de retrait et purger leur cache.
- La révocation/refus du mandat ou l'arrêt de l'autorisation de diffusion désactive les canaux concernés conformément à la règle de la spec 03. `NEEDS_CORRECTION` suspend également la diffusion jusqu'à approbation. La relation API ne détermine pas le droit de diffuser.
- Aucune API d'intégration ne permet de créer, modifier, publier ou réactiver un bien ; les opérations d'écriture restent dans les clients Paradis Immo authentifiés.

### API et accès partenaires

- Exposer une surface distincte et versionnée pour les intégrations (ex. `/api/partner/v1`), derrière la passerelle d'API/configuration de quotas retenue par l'architecture. Ne pas exposer aux partenaires un jeton utilisateur, un bearer interne, une clé globale ou l'API de gestion.
- Chaque intégration possède un identifiant, une agence propriétaire, un nom, des scopes, des dates de création/révocation, un environnement et des compteurs d'usage.
- Scopes initiaux en lecture seule, limités aux projections d'annonces publiques et aux changements de catalogue. Les scopes de réception de leads ne sont ajoutés qu'à l'intégration qui en a besoin.
- L'authentification est propre aux intégrations, avec secrets stockés sous forme protégée, affichés une seule fois à leur création/rotation et révocables. Choisir et documenter un mécanisme adapté aux consommateurs (OAuth client credentials ou clés d'accès signées/rotatives) avant implémentation ; ne jamais intégrer un secret privilégié dans une application mobile distribuée.
- Les identifiants sont rattachés à une intégration précise, jamais partagés entre agences. Révocation immédiate, rotation avec période de chevauchement bornée, séparation test/production et moindre privilège.
- Appliquer quotas, limitation de débit, limites de pagination, validation, journalisation d'accès et détection d'abus. Les réponses d'erreur ne divulguent ni existence d'autres agences ni secret.
- Supporter pagination stable, filtrage par changements depuis un curseur (`updatedSince`/cursor), versionnement du schéma, horodatage de synchronisation et réponse exploitable pour les suppressions/retraits (tombstones ou événements explicites).
- Les webhooks éventuels utilisent signature vérifiable, horodatage et anti-rejeu. Ils sont rejouables de façon bornée et idempotente ; un endpoint de récupération par curseur reste disponible pour réparer une perte d'événement.
- Prévoir une documentation d'intégration (OpenAPI, schémas d'exemple, sandbox, limites, erreurs, versionnement, procédure de rotation et de révocation) sans y placer de clés ou de données réelles.

### Leads et attribution

- Les canaux configurés définissent la destination du lead : boîte de réception Paradis Immo, webhook d'intégration configuré et vérifié, ou les deux. Une destination externe doit être vérifiée et désactivable ; ne pas permettre une URL arbitraire saisie sans protection contre SSRF.
- Chaque lead conserve au minimum : `propertyId`, `sourceChannel`, `integrationId` si applicable, horodatage, type de demande, statut de traitement et référence idempotente. Les données de contact sont minimisées et soumises aux règles de confidentialité/retention.
- Le canal d'origine est immuable dans les événements/rapports. Une redirection vers la destination de l'agence ne doit pas effacer la provenance.
- En cas d'échec du webhook, garder la demande dans la boîte Paradis Immo si ce routage est activé, enregistrer l'échec, réessayer selon une politique bornée et rendre l'état visible à l'agence. Ne jamais annoncer un envoi réussi si la destination n'a pas accusé réception.
- La politique de consentement/contact et les finalités d'utilisation des données doivent être présentées au visiteur sur le canal où il transmet sa demande. Les partenaires ne réutilisent pas les contacts à d'autres fins.
- Les réponses aux demandes et conversations ne sont pas exposées par défaut à l'API catalogue ; leur éventuel retour vers le site partenaire est un scope distinct et reste à décider.

### Offre partenaires et services personnalisés

- La plateforme publie une documentation et une procédure d'accès partenaire ; la validation d'un partenaire technique est distincte de l'approbation d'une agence et de la création d'une intégration.
- L'agence reste propriétaire/administratrice de ses identifiants, domaine et accès. Un partenaire intervient avec l'autorisation explicite de l'agence, révocable sans perte de l'accès direct de l'agence.
- Définir contractuellement qui détient le domaine, le code source, les contenus, comptes d'hébergement, certificats, sauvegardes et accès de reprise à la fin de la prestation.
- Distinguer les frais de conception/développement/hébergement/support des frais de plateforme, d'API ou de marketplace. Modèle de prix, commission partenaire, fiscalité, SLA et responsabilité restent à décider avant commercialisation.
- Prévoir un transfert documenté des accès et une procédure de continuité si le partenaire cesse son activité.
- Ne promettre aucun délai, disponibilité, référencement ou résultat commercial avant définition des niveaux de service et validation de l'offre.

## Modèle de données cible (indicatif)

Les noms/champs précis seront alignés sur le schéma courant et l'ADR avant migration.

```prisma
enum ListingChannel {
  PARADIS_MARKETPLACE
  AGENCY_WEBSITE
  AGENCY_APP
  PARTNER
}

enum IntegrationStatus {
  ACTIVE
  REVOKED
  SUSPENDED
}

model AgencyChannelSettings {
  id                 String   @id @default(cuid())
  organizationId     String
  channel            ListingChannel
  enabled            Boolean  @default(false)
  leadRouting         Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@unique([organizationId, channel])
}

model PropertyChannel {
  propertyId          String
  channel             ListingChannel
  enabled             Boolean
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@id([propertyId, channel])
}

model PartnerIntegration {
  id                 String   @id @default(cuid())
  organizationId     String
  name               String
  channel            ListingChannel
  status             IntegrationStatus
  scopes             String[]
  credentialHash     String
  credentialVersion  Int
  lastUsedAt         DateTime?
  revokedAt          DateTime?
  createdAt          DateTime @default(now())
}

model PropertyIntegrationListing {
  propertyId          String
  integrationId       String
  enabled             Boolean
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  @@id([propertyId, integrationId])
}

model ListingSyncEvent {
  id                 String   @id @default(cuid())
  propertyId         String
  integrationId      String
  eventType          String
  occurredAt         DateTime @default(now())
  payloadVersion     Int
  deliveredAt        DateTime?
  attemptCount       Int      @default(0)
}

model ListingLead {
  id                 String   @id @default(cuid())
  propertyId         String
  sourceChannel      ListingChannel
  integrationId      String?
  idempotencyKey     String?
  status             String
  createdAt          DateTime @default(now())
}
```

Les secrets réels ne sont jamais enregistrés en clair. Le modèle ci-dessus est conceptuel : stratégies de clés, livraison outbox, contraintes de nullabilité/clé composite et rétention doivent être finalisées après choix d'architecture.

## Contrats API cibles

| Méthode | Route indicative | Rôle | Description |
|---|---|---|---|
| GET/PATCH | `organizations/:id/channels` | ADMIN agence | Lire/modifier canaux par défaut, routage des leads et réglages validés |
| GET/POST | `organizations/:id/integrations` | ADMIN agence | Lister/créer une intégration externe avec scopes minimum ; secret affiché une fois |
| POST | `organizations/:id/integrations/:integrationId/rotate` | ADMIN agence | Rotation contrôlée du secret |
| POST | `organizations/:id/integrations/:integrationId/revoke` | ADMIN agence | Révoquer immédiatement l'accès |
| GET/PATCH | `properties/:id/channels` | gestionnaire autorisé du bien | Lire/ajuster la diffusion par bien, dans les canaux disponibles à l'agence |
| GET | `partner/v1/listings` | intégration lecture seule | Projection publique paginée, filtrée par scopes/agence/canaux autorisés |
| GET | `partner/v1/changes` | intégration lecture seule | Changements depuis un curseur, y compris retraits |
| POST | `partner/v1/leads` | intégration avec scope lead entrant | Créer une demande avec provenance et idempotence |
| GET | `organizations/:id/channel-stats` | ADMIN agence | Agrégats par canal et période, selon définitions validées |
| GET | `admin/integrations` | PLATFORM_ADMIN autorisé | Supervision, suspensions et usage selon RBAC admin |

Les routes sont indicatives et ne préjugent pas des contrôleurs existants. Les opérations agence utilisent le contrat d'organisation et l'autorisation API ; les routes partenaires sont isolées de l'API de gestion.

### Projection catalogue minimale (indicative)

`id` ou référence publique stable, titre, description publique, type/mode, prix/devise/unité, surface/chambres/salles de bain pertinentes, équipements publics, ville/quartier, adresse publique autorisée, coordonnées publiques floutées, disponibilité/statut d'annonce, médias publics ordonnés, agence et date de mise à jour. Les champs optionnels absents restent absents/null selon un schéma documenté ; le client ne fabrique pas de valeurs.

## Interfaces

### Portail agence

- **Paramètres > Diffusion** : état de la marketplace Paradis Immo, canaux externes, intégrations autorisées, compteurs, scopes, dernière synchronisation, destinations de leads et guides d'intégration.
- **Intégrations** : créer une intégration avec nom, environnement, canal, domaines autorisés (si pertinents), scopes minimum et URL webhook vérifiée ; montrer le secret une fois, confirmer rotation/révocation et afficher dernière utilisation.
- **Formulaire et fiche du bien** : sélecteur des canaux disponibles avec indication « hérite des paramètres de l'agence » ou « personnalisé pour ce bien » ; signaler les raisons d'indisponibilité (modération, statut, mandat, organisation suspendue) sans permettre de contourner les règles.
- **Demandes/contacts** : indiquer clairement le canal source, le statut de transmission et l'échec éventuel d'un webhook ; filtres par période, canal et intégration.
- **Statistiques** : impressions, vues et leads si mesurés ; définir chaque métrique, période, déduplication, fenêtre d'attribution et canal. Ne pas comparer des métriques de partenaires dont les définitions diffèrent sans avertissement.

### Back-office plateforme

- Liste des intégrations selon les permissions admin : agence, nom, état, environnement, scopes, date de création, dernier usage, quotas, suspensions/abus ; ne jamais afficher un secret.
- Suspension/réactivation avec motif, accès aux logs techniques minimisés et trace d'audit.
- Les contrats commerciaux, données de facturation et commissions de partenaires ne sont affichés que si ces fonctions sont effectivement prises en charge.

### Expérience chercheur

- Le site/app partenaire identifie clairement l'agence responsable de l'annonce et la source de la demande.
- Toute demande affiche les informations de confidentialité et le canal de contact. Le chercheur peut adresser une demande selon le parcours et le consentement affichés sur ce canal.

## Critères d'acceptation

- Une agence active Marketplace et Website simultanément sans que l'un désactive l'autre.
- Un changement agence-par-défaut n'écrase pas silencieusement les choix explicitement personnalisés par bien.
- Un canal ne délivre pas un bien d'une autre agence, d'une autre intégration ou non autorisé ; tests négatifs par ID direct, pagination et curseur.
- Aucun champ privé ou adresse exacte masquée n'est présent dans la projection partenaire.
- Un changement ACTIVE → PAUSED/SOLD/OCCUPIED, une décision de modération ou un retrait de canal apparaît dans le flux de changement et disparaît du catalogue au délai contractuel.
- Un secret révoqué ne permet plus d'accéder au catalogue ; rotation respecte uniquement la courte période de chevauchement explicitement configurée.
- Des credentials d'une application publique/mobile ne contiennent aucun secret permettant l'accès d'agence.
- Un webhook rejoué ne crée pas de leads en double ; signature invalide, timestamp expiré et destinataire non vérifié sont refusés.
- Un webhook indisponible donne lieu à retry borné, résultat d'échec visible et état de succès non mensonger.
- Un échec d'intégration n'empêche pas la diffusion sur les autres canaux ni la gestion du bien dans Paradis Immo.
- La révocation d'une intégration n'altère ni l'annonce dans Paradis Immo ni les autres intégrations de l'agence.
- Les rapports distinguent la source des demandes et n'additionnent pas des métriques hétérogènes sans définition.
- Une relation avec un partenaire technique ne lui permet pas d'accéder à l'espace agence, aux documents privés, aux mandats ou aux données d'autres agences.
- Les règles des specs 03/13 continuent de bloquer une diffusion sans publication/modération/droits requis, quel que soit le canal.

## Décisions à prendre avant implémentation/commercialisation

| Décision | À trancher avant |
|---|---|
| Mécanisme d'authentification partenaire (OAuth client credentials, clés signées/rotatives, ou fournisseur gateway) et terminaison TLS | Création de l'API de production |
| Garantie de délai de propagation des modifications/retraits, fréquence de polling, disponibilité des webhooks et SLA | Publication des contrats aux partenaires |
| Schéma public exact, champs adresse/géolocalisation, fréquence de breaking changes et support des anciennes versions | Lancement du premier connecteur |
| Routage par défaut des leads et consentement/contact selon canal | Activation de lead entrant ou webhook |
| Mesures d'audience, déduplication, consentement cookies/analytics et attribution | Tableau de bord de performance |
| Tarification API, offre Marketplace/SaaS, hébergement, développement, maintenance, commission et fiscalité | Vente de l'offre aux agences |
| Contrats de service, responsabilité, propriété intellectuelle, transferts de comptes/domaine/code, sous-traitance et traitement des données | Signature avec partenaires et livraison de sites/apps |
| Rôles admin plateforme autorisés à superviser/suspendre les intégrations | Ouverture du back-office intégrations |

Tout nouveau protocole d'accès inter-systèmes, toute réutilisation de données ou tout engagement de SLA/commercial doit faire l'objet de validations sécurité, confidentialité et contractuelles ; les choix d'architecture structurants sont consignés dans un ADR avant mise en œuvre.

## Priorités et delta d'implémentation

- **P0** : aucun secret interne exposé ; isolation par agence/intégration ; retraits respectés ; intégrations révocables ; cohérence avec règles publication/modération/mandat.
- **P1** : configuration multi-canal dans le portail, projection de catalogue, curseur de synchronisation, traçabilité source des leads, routage fiable.
- **P2** : analytics multicanal, onboarding self-service partenaires, webhooks avancés, catalogue de partenaires, offre commerciale développement/hébergement/support.

| ID | Priorité | Delta | État |
|---|---|---|---|
| 17.1 | P0 | Définir et sécuriser les canaux, projections publiques, credentials et révocation par agence. | **À faire** |
| 17.2 | P1 | Ajouter configuration agence/bien, API catalogue versionnée et synchronisation des retraits. | **À faire** |
| 17.3 | P1 | Attribuer les leads par source et router les demandes avec états d'échec/retry visibles. | **À faire** |
| 17.4 | P2 | Ajouter analytics comparables et parcours opérationnel de partenaires techniques. | **À faire** |
| 17.5 | P2 | Définir et commercialiser l'offre de sites/apps personnalisés, contrats, prix et support. | **À décider** |
