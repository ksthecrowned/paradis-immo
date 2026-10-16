# Plan d’implémentation — Clients d’agence et mandats

> Plan de travail fondé sur le code local inspecté le 2026-10-16. Ce document décrit le comportement décidé dans la conversation et les changements à réaliser ; il ne signifie pas que ceux-ci sont implémentés.

## Objectif

Permettre à une agence de gérer son portefeuille de propriétaires, qu’ils aient ou non un compte Paradis Immo, puis de rattacher un bien à l’un de ses clients. Un mandat est associé à chaque bien géré :

- pour un client avec compte, le mandat est proposé dans Paradis Immo et le propriétaire le valide depuis son compte ;
- pour un client sans compte, l’agence dépose une copie privée du mandat signé hors plateforme, soumise à la revue d’un administrateur de la plateforme ;
- **pendant l’attente de la validation ou de la revue, l’agence peut préparer et modifier le bien, le publier, organiser les visites et gérer les opérations locatives**. L’état du mandat ne doit pas, à lui seul, bloquer ces opérations.

La relation client, le propriétaire déclaré d’un bien, le mandat, les autorisations opérationnelles et la revue d’un document sont des notions séparées. Un client n’est pas un membre de l’agence ; un lien CRM ne prouve pas la propriété et ne vaut pas mandat.

## Comportements retenus

1. Chaque relation client appartient à une agence. Le même propriétaire peut être client de plusieurs agences, sans que celles-ci voient les données CRM, biens ou mandats des autres.
2. Un client est soit lié à un compte existant, soit enregistré comme contact externe sans compte. Une fiche externe ne crée pas de compte utilisateur factice.
3. Seuls les administrateurs de l’agence gèrent le portefeuille clients. Les agents peuvent consulter et sélectionner un client de leur agence lors de la création ou de la modification autorisée d’un bien.
4. L’agent peut remplacer le client choisi pour un bien, mais seulement par un autre client de son agence. Le changement est audité et ne modifie pas silencieusement l’historique des mandats.
5. Pour un client lié à un compte, le mandat virtuel attend l’action explicite du propriétaire. Pour un contact externe, l’agence dépose le document signé et l’administrateur plateforme le passe en revue.
6. Dans les deux parcours, le statut d’attente n’empêche pas l’agence de préparer/modifier le bien, le publier, organiser les visites et gérer les locations. Les contrôles d’approbation déjà prévus pour certaines actions (signature de bail, réparation au-dessus du seuil, etc.) restent applicables. Les ventes et mouvements financiers restent soumis à leurs propres règles et ne sont pas implicitement élargis par cette décision.
7. Un refus explicite du propriétaire ou le rejet définitif du document doit mettre fin à l’accès provisoire de l’agence et déclencher la règle produit de suspension/retrait de l’annonce. Le cas exact d’une annonce déjà publiée est à confirmer avant implémentation ; proposition par défaut : la passer en PAUSED et empêcher les nouvelles opérations au nom du propriétaire.
8. Les sections explicitement réservées à l’ADMIN de l’agence dans ce périmètre sont la gestion du portefeuille clients et le dépôt/remplacement des mandats papier. Les agents peuvent consulter/sélectionner les clients et gérer les biens selon leur assignation. Cela ne modifie pas les permissions déjà définies pour les autres sections.
9. Pour un contact externe qui crée ensuite un compte, le rattachement n’est jamais automatique : il nécessite la vérification du numéro et la confirmation explicite du propriétaire. En cas de numéro différent ou inaccessible, un parcours de vérification assistée est requis.
10. La revue plateforme vérifie le mandat papier et un justificatif de propriété ou d’autorisation de gestion. Elle ne constitue pas une certification juridique de la signature ni une garantie irréfragable de propriété.

## État actuel observé et principaux écarts

- `PropertiesService.create()` accepte `ownerId` ou `ownerPhone`. Le chemin téléphone appelle `UsersService.resolveOrCreateByPhone()`, crée/réutilise un compte et crée immédiatement un `Mandate` `ACTIVE`.
- `Property.ownerId` est obligatoire et référence `User`. Le modèle ne permet donc pas de représenter proprement un propriétaire externe sans compte.
- `AgencyAccessService` autorise l’exploitation au travers de mandats `ACTIVE` et `TERMINATING` uniquement. Il faut dissocier l’accès opérationnel provisoire de l’état de consentement/revue.
- Les routes portefeuille `/agent/portfolio` et mandat `/agent/mandates` existent. Il n’existe pas de portefeuille clients d’agence ni de file admin de revue des mandats externes.
- Le domaine Mandate dispose déjà de versions, d’acceptation/refus, de signature OTP, d’un dépôt privé R2 pour le PDF signé et d’une URL de téléchargement limitée aux parties. Il faut réutiliser ces mécanismes sans leur attribuer des garanties qu’ils n’offrent pas.
- La spec 03 décrit déjà les mandats PROPOSED/ACTIVE, mais son critère « aucun accès avant acceptation » contredit la décision produit présente. La spec doit être amendée explicitement.

## Procédure de rattachement d’un contact externe à un compte

Le numéro sert à trouver un candidat, pas à fusionner automatiquement une identité ni à prouver la propriété du bien.

1. **Déclencheur** : le contact crée un compte ou demande le rattachement depuis un compte existant. Le système cherche une fiche externe uniquement sur correspondance exacte du numéro normalisé, vérifié par le compte.
2. **Confirmation par le propriétaire** : après authentification et vérification du numéro par OTP, présenter à l’utilisateur le nom de l’agence et une explication claire qu’elle a déjà une fiche de contact. Ne pas exposer le dossier, les biens ou les documents avant sa confirmation explicite.
3. **Décision** : l’utilisateur confirme ou refuse. En cas de refus, ne rien fusionner ni transférer ; garder la fiche dans le CRM de l’agence. L’agence reçoit au plus un état générique, sans motif ni information privée.
4. **Rattachement atomique** : après confirmation, vérifier de nouveau l’unicité et l’absence de conflit, puis lier `AgencyClient.userId` au compte dans une transaction. Conserver l’identifiant CRM, les notes/historique autorisés et les liens vers biens/mandats ; ne pas écraser les données vérifiées du compte avec les champs saisis par l’agence. Écrire un audit du demandeur, de la confirmation et de la date.
5. **Accès après rattachement** : rendre visibles au propriétaire connecté les biens et documents attachés à sa fiche avec leur état réel (mandat en attente, document reçu, revue acceptée/refusée). Le rattachement ne change aucun statut de mandat, ne prouve pas la propriété et ne crée pas une acceptation de mandat.
6. **Numéro différent, modifié ou inaccessible** : aucune correspondance automatique par nom, e-mail non vérifié ou similarité. Ouvrir une demande de vérification assistée par l’admin plateforme, indépendante de l’agence, selon la procédure de récupération/identification approuvée. Sans preuve suffisante, garder les fiches séparées. Une nouvelle adresse/numéro ne remplace pas les anciennes preuves.
7. **Conflit et doublon** : si le compte est déjà lié à une autre fiche CRM active de la même agence, ou qu’une relation ne peut pas être déterminée sans ambiguïté, bloquer la mutation automatique et envoyer au parcours de résolution/admin. Ne jamais transférer les biens ou fusionner deux comptes en arrière-plan.

## Règles désormais décidées et points encore à figer

Ces points ne sont pas des fonctionnalités à inventer au fil du code ; ils doivent être inscrits dans la matrice métier/API avant de modifier les contrats :

1. **Modèle canonique de propriétaire d’un bien.** Définir comment `Property.ownerId` et l’organisation propriétaire existante cohabitent avec un client externe. Recommandation : ajouter une relation CRM `agencyClientId` et autoriser un propriétaire sans `User`, sans créer de faux compte ; préserver les biens auto-déclarés par les propriétaires existants. Poser une contrainte métier/base garantissant une seule identité propriétaire valide par bien et documenter l’usage de `Property.organizationId` pour les biens externes.
2. **États et transition de fin d’attente.** Définir le traitement d’un refus du propriétaire, d’un document rejeté, d’une correction en attente, d’une expiration et d’une révocation. Ne pas confondre statut du mandat et statut de revue documentaire.
3. **Portée confirmée de l’accès provisoire.** L’agence peut préparer/modifier le bien, le publier, organiser des visites et gérer les locations pendant l’attente. Cela n’accorde pas automatiquement un droit de reversement vers un bénéficiaire externe non vérifié et ne remplace pas les approbations métier existantes. Les ventes et autres mouvements financiers suivent leurs permissions propres.
4. **Permissions d’agence confirmées.** ADMIN uniquement : gérer le portefeuille clients et déposer/remplacer les mandats papier. AGENT : consulter/sélectionner les clients de son agence et agir sur ses biens assignés. Le plan ne change pas les permissions des autres sections existantes.
5. **Ajout d’un compte existant au CRM.** La recherche par numéro retourne uniquement un résultat minimal pour permettre à l’admin de confirmer la bonne personne. L’ajout au CRM ne donne aucun accès aux biens/données du compte et ne vaut pas acceptation du mandat. L’acceptation du mandat reste nécessaire séparément ; décider à la conception si l’ajout CRM déclenche une notification d’information.
6. **Revue documentaire confirmée.** L’admin plateforme vérifie la lisibilité et la complétude du mandat, la cohérence des parties et du bien, la présence des dates/signatures requises et un justificatif de propriété ou d’autorisation de gestion. Il ne certifie pas l’authenticité juridique de la signature ni ne remplace un contrôle légal. Ajouter une décision « à corriger / informations complémentaires requises » en plus d’accepter ou refuser, avec motif obligatoire.
7. **Conséquence d’un refus définitif.** La règle produit proposée est de retirer l’accès opérationnel provisoire et de mettre l’annonce en PAUSED, avec historique conservé. Confirmer ce traitement et la distinction entre refus du propriétaire, document incomplet (corrigeable) et rejet définitif avant activation.

## Plan par lots

### Lot 0 — Contrat produit, permissions et architecture

**Travaux**

- Mettre à jour les règles et critères d’acceptation dans `docs/specs/02-organisations-equipes.md`, `docs/specs/03-gerance-mandats-comptabilite.md`, `docs/specs/12-admin-back-office.md` et l’index/delta `docs/specs/15-consolidation.md`.
- Remplacer dans la spec 03 la règle « mandat PROPOSED = aucun accès agence » par deux axes distincts : validation du mandat et accès provisoire convenu ici. Définir précisément ce qui s’arrête après refus/rejet.
- Formaliser une matrice rôle × action × état : admin agence, agent assigné, propriétaire utilisateur, admin plateforme ; CRM, changement de propriétaire, publication, visites, baux, documents, finance, décision de revue.
- Produire/mettre à jour un ADR si le modèle de propriété ou l’accès provisoire constitue une décision multi-domaines difficile à inverser.

**Critère de sortie**

- Aucun état ambigu entre client CRM, compte utilisateur, propriétaire de bien, mandat, consentement virtuel, document externe, revue plateforme et droit opérationnel.
- La portée du statut « en attente » et les actions après refus sont explicites avant la migration.

### Lot 1 — Modèle CRM agence et migration

**Travaux**

- Ajouter un modèle `AgencyClient` (nom, téléphone normalisé/E.164, e-mail facultatif, agence, créateur, dates, statut d’archivage, note interne si validée par la politique de données) avec `userId` nullable pour le compte lié. Les informations d’un compte lié ne doivent pas devenir une copie mutable concurrente de `User`.
- Représenter le rattachement en attente/refusé (par exemple `UNLINKED`, `CLAIM_PENDING`, `LINKED`, `CLAIM_DECLINED`) ou par une demande dédiée portant expiration, compte cible, date de vérification, décision et audit ; ne jamais déduire `LINKED` du seul numéro saisi par l’agence.
- Autoriser plusieurs fiches d’agence pour un même compte utilisateur, mais une seule relation active par couple agence/compte. Empêcher les doublons actifs par agence sur les numéros normalisés lorsque c’est applicable ; traiter les numéros absents/changés sans fusion arbitraire.
- Ajouter les relations et index nécessaires. Définir la référence propriétaire sur `Property` pour les clients liés et externes ; conserver la compatibilité des biens existants et des créations directes par OWNER.
- Ajouter un historique/audit du changement de client propriétaire par bien (ancien/nouveau client, auteur, date, motif si requis) et conserver les anciens mandats/pièces pour la traçabilité.
- Créer une migration additive et compatible avec les lignes existantes. Ne pas convertir automatiquement les mandats historiques `ACTIVE` en attente ni fabriquer des clients CRM pour toutes les anciennes propriétés sans stratégie de backfill validée.
- Générer Prisma et écrire des tests de contraintes, relations, suppression/archivage et migration/backfill.

**Critère de sortie**

- Un contact externe n’a pas de ligne `User` artificielle ; un bien existant reste lisible et gérable ; l’identité propriétaire ne peut pas être incohérente ou provenir d’une autre agence.

### Lot 2 — API CRM et contrôle d’accès

**Travaux**

- Ajouter un module/service/contrôleur CRM agence, réutilisant les contrôles d’appartenance active et le pattern `AgencyAccessService`.
- Contrats minimaux :
  - liste paginée des clients par agence, filtre compte/externe/statut/recherche ;
  - recherche exacte d’un compte par numéro normalisé, avec retour minimal pour confirmation et liaison ;
  - création d’un contact externe ;
  - détail et modification/archivage d’un client par admin agence ;
  - liste de clients sélectionnables par agent, sans mutation CRM ;
  - ajout/rattachement d’un compte existant sans révéler les informations hors besoin.
- ADMIN/OWNER d’agence habilité selon la règle de rôles retenue ; AGENT interdit sur création, modification, archivage et gestion de relation. Vérifier chaque endpoint par identifiant direct, filtre, pagination et organisation active.
- Reprendre la normalisation des numéros et le mécanisme de limitation/audit existant de `GET users/lookup` ; éviter l’énumération de comptes et ne pas exposer nom complet, e-mail, rôle, KYC ou portefeuille sans nécessité.
- Ajouter audit métier pour création, liaison, édition, archivage, recherche sensible et changement de client sur bien. Ne jamais journaliser OTP, tokens ou téléphone complet en logs techniques.

**Critère de sortie**

- Test négatif pour autre agence, agent, membre inactif, compte non trouvé, numéro ambigu, doublon, ID deviné et client archivé.

### Lot 3 — Mandat virtuel, document hors plateforme et revue admin

**Mandat virtuel (client lié à un compte)**

- Réconcilier le flux existant où OWNER propose un mandat à l’agence et celui où l’agence rattache un bien à son client. Éviter de réutiliser un seul `PROPOSED` avec deux sens implicites : représenter clairement l’initiateur, la version des conditions et l’acteur attendu.
- Créer à la création du bien un mandat virtuel avec snapshot des conditions, trace de l’agent/admin qui l’a proposé et destinataire propriétaire déterminé par le client lié.
- Notifier le propriétaire via les canaux disponibles et afficher agence, bien, périmètre, durée, commissions/frais et autorisations avant acceptation/refus.
- L’acceptation doit être une action authentifiée du compte propriétaire ; enregistrer acteur, date, version et preuve. Prévoir refus avec motif, notifications, expiration/relances et idempotence. Conserver la signature OTP/PDF existante si elle est requise par la définition produit/juridique, sans considérer une simple notification comme consentement.

**Mandat externe (client sans compte)**

- Permettre à l’admin d’agence de déposer/remplacer un mandat signé via le stockage privé existant ; contrôler format, taille, type réel, antivirus si disponible, association agence/bien/mandat et accès aux téléchargements.
- Ajouter un état de revue séparé du statut de mandat, une file plateforme paginée, détail sécurisé, décisions `APPROVED`, `NEEDS_CORRECTION` et `REJECTED` avec motif obligatoire, auteur/date, version du fichier et historique immuable.
- La checklist de revue vérifie : toutes les pages présentes et lisibles ; identité/qualité des parties cohérente avec la fiche client et l’agence ; bien identifiable sans ambiguïté ; périmètre, durée et conditions du mandat renseignés ; dates et signatures requises visibles ; justificatif de propriété ou d’autorisation de gestion présent et cohérent avec le propriétaire déclaré. Toute incohérence ou pièce manquante mène à `NEEDS_CORRECTION`, pas à une acceptation par défaut.
- L’écran précise à l’admin que la revue est documentaire et ne certifie ni l’authenticité légale des signatures, ni une propriété opposable. L’admin peut examiner les pièces privées nécessaires à cette checklist ; tous les accès et décisions sont journalisés. Définir durée de conservation et accès ultérieur selon les règles de documents privés/KYC.
- À l’approbation, enregistrer le résultat documentaire et les métadonnées de preuve. Le bouton « approuver » ne doit pas prétendre certifier juridiquement la signature.
- À la correction/re-soumission, conserver l’historique et ne plus présenter l’ancienne version comme la version courante.

**Événements**

- Émettre des événements idempotents pour proposition, acceptation/refus du propriétaire, dépôt, demande de correction, approbation/rejet admin et expiration ; relier notifications propriétaire, agence et file admin.
- Vérifier listeners/retry et éviter les notifications en double sur reprise de jobs.

**Critère de sortie**

- Chaque chemin a un seul décideur autorisé, une preuve/version consultable, une décision auditée et des états d’erreur/réessai explicites.

### Lot 4 — Autorisations opérationnelles en attente

**Travaux**

- Créer une règle centrale d’accès provisoire tenant compte de l’agence, du client propriétaire, de l’assignation agent et de l’état du dossier. Ne pas remplacer partout `ACTIVE` par `PROPOSED` sans examiner les opérations métier.
- Auditer tous les consommateurs de `AgencyAccessService` et des filtres de mandat : listes/détails/mutations de biens, publication, visites/créneaux, réservations, candidatures, baux, maintenance, ventes, documents, approbations, dépenses, paiements, comptabilité/relevés et exports.
- Permettre dans l’état d’attente convenu la préparation et la modification du bien, publication, visites et gestion locative. Garder les approbations owner préexistantes comme seuil indépendant.
- Pour le mandat virtuel en attente, le propriétaire connecté est l’identité canonique ; pour le contact externe, ne pas renvoyer une propriété ou des documents dans les surfaces OWNER comme s’il existait un compte.
- Définir la révocation de l’accès provisoire : refus/expiration/rejet définitif, désactivation du membre, archivage client ou changement de propriétaire. Révoquer les accès caches/URLs présignées selon leur TTL ; arrêter les nouvelles actions et mettre l’annonce en PAUSED si cette règle est confirmée.
- Garder les états de listing et de mandat orthogonaux : la publication peut être ACTIVE alors que le mandat attend la validation, conformément à la décision produit, sans étiqueter le mandat comme signé/actif.
- Préserver les limites financières : pas de reversement à un bénéficiaire externe non vérifié ; ne pas produire de commissions/ledger imputant un accord final inexistant sans décision explicite.

**Critère de sortie**

- Tests de matrice autorisé/refusé sur toutes les surfaces ; aucune route secondaire ou URL directe ne contourne la règle.

### Lot 5 — Portail agence, sélection du propriétaire et revue plateforme

**Écrans agence**

- Ajouter `/agent/clients` et `/agent/clients/[id]` (nom final selon conventions de routes) avec recherche, pagination, filtres, états vide/erreur/chargement, catégories « compte Paradis Immo » et « contact externe », détail et biens associés.
- Contrôler côté UI les actions admin uniquement, sans substituer cette protection à l’API. Ajouter le lien de navigation « Clients » et rendre visibles le contexte/agence actif.
- Ajouter formulaires admin : rechercher un compte par numéro, confirmer le profil minimal, l’ajouter ; ou créer un contact externe. Prévoir erreurs de numéro, doublon, numéro déjà lié, archive et annulation.
- Remplacer dans `apps/web/components/properties/property-form.tsx` les champs libres nom/téléphone actuels par une sélection de clients autorisés pour création agent. En édition, permettre à l’agent de choisir un autre client de la même agence et confirmer le changement ; montrer le mandat lié et l’effet sur l’historique.
- Adapter les pages portefeuille et détail du bien pour indiquer propriétaire client, compte/non-compte et état du mandat sans présenter un mandat en attente comme accepté.
- Ajouter gestion admin du document et statut de revue depuis la page mandat/détail du bien.

**Écrans propriétaire et plateforme**

- Compléter `/owner/mandate` et son détail pour visualiser et accepter/refuser le mandat virtuel, avec présentation de sa version/conditions et preuve d’action.
- Ajouter une file `/admin/...` pour revue des mandats déposés, avec filtres, preview sécurisé, décision, motif et historique ; adapter route API, navigation et permission PLATFORM_ADMIN.
- Maintenir les flux web/mobile cohérents : l’app mobile n’a actuellement pas de section portefeuille/mandats propriétaire identifiée. Au minimum, le lien de notification doit ouvrir un parcours web authentifié utilisable sur mobile ; ajouter un écran mobile seulement si le produit exige une acceptation native.
- Ajouter badges et filtres « Validation propriétaire en attente », « Document à revoir », « Refusé » sur portefeuille/mandats et dashboard pertinents.

**Critère de sortie**

- Parcours complet utilisable au clavier et mobile ; agents incapables de créer/éditer les fiches clients ; plateforme incapable d’accéder à un document hors file de revue/autorisations.

### Lot 6 — Données historiques, tests et livraison

**Tests API et données**

- Tests unitaires/intégration CRM : liaison user, contact externe, unicité, isolation multi-agence, normalisation téléphone, archivage et changements concurrentiels.
- Tests du rattachement de compte : téléphone vérifié correspondant, confirmation explicite, refus, OTP expiré/invalide, numéro différent, compte déjà lié, doublon dans la même agence, demande concurrente, absence d’accès aux biens avant confirmation et conservation des preuves/historique après liaison.
- Tests création/édition bien : client seulement dans l’agence, owner externe sans User artificiel, mandat/proposition et preuve correctement créés, changement de client audité, anciennes données inchangées.
- Tests de transitions mandat : acceptation/refus propriétaire, dépôt/replacement document, revue admin, rejet/correction, expiration, idempotence, course entre acceptation et refus, double soumission.
- Tests de revue documentaire : chaque élément de checklist, demande de correction, resoumission versionnée, motifs requis, décision concurrente et impossibilité pour un admin d’agence/agent de décider la revue plateforme.
- Tests d’accès sur les scénarios API de chaque domaine listé au lot 4 : attente autorisée selon la décision ; après révocation/refus refusée ; membre non assigné/inactif, autre agence et rôle incorrect interdits.
- Tests stockage privé : fichier non public, téléchargement borné aux parties/admins autorisés, accès direct interdit, métadonnées et suppression/retention auditées.
- Tests UI API mockés : états chargement/vide/erreur/retry, sélection de client, recherche téléphone, confirmation changement de propriétaire et deux parcours de mandat.
- Vérifier contrats OpenAPI/types générés si concernés, migrations sur copie locale dédiée, génération Prisma, tests ciblés, build/lint API et web. Les E2E nécessitant PostgreSQL doivent utiliser la configuration de test dédiée.

**Migration et activation**

- Faire une revue des biens créés « pour propriétaire » et mandats `ACTIVE` historiques ; produire un rapport de transition, pas une activation/désactivation silencieuse.
- Déployer en phases compatibles : schéma additif, API lisant ancien et nouveau modèle, backfill contrôlé, UI, puis écriture du nouveau flux. Documenter rollback et procédure de support.
- Feature flag pour la nouvelle création agence si nécessaire ; désactiver l’ancien chemin `ownerPhone` au moment où le formulaire et CRM sont disponibles, sans retirer l’API avant compatibilité des clients.
- Mettre à jour docs, OpenAPI, permissions, runbook de stockage/revue, critères de lancement et matrice de tests. Aucun déploiement ou migration réelle n’est présumé par ce plan.

## Fichiers et surfaces principalement concernés

À confirmer pendant l’implémentation après vérification des contrats précis :

- API/schema : `apps/api/prisma/schema.prisma`, nouvelle migration, `apps/api/src/app.module.ts`, nouveau domaine agence-clients, `apps/api/src/properties/{properties.service.ts,properties.controller.ts,dto/create-property.dto.ts}`, `apps/api/src/mandates/`, `apps/api/src/admin/`, `apps/api/src/media/`, `apps/api/src/events/`, `apps/api/src/notifications/`.
- Contrôle d’accès : `apps/api/src/mandates/agency-access.service.ts` et ses consommateurs dans properties, leases, visit-slots, bookings, maintenance, sales, payments, accounting et documents.
- Web : `apps/web/lib/routes.ts`, `apps/web/components/dashboard/sidebar-nav.tsx`, `apps/web/app/agent/`, `apps/web/app/owner/mandate/`, `apps/web/app/admin/`, `apps/web/components/properties/property-form.tsx`, clients API sous `apps/web/lib/agent/`, `apps/web/lib/owner/` et `apps/web/lib/admin/`.
- Docs canoniques : specs 02, 03, 12, 15, spec 16 si les règles de fichiers/consentement sont affectées, plus ADR si requis.
- Tests près de chaque domaine et tests E2E dédiés aux permissions, transitions et migration.

## Ordre de livraison recommandé

1. Lot 0 et décisions bloquantes, avant de figer le schéma.
2. Lot 1 puis Lot 2 (CRM), avec migration compatible.
3. Lot 3 (preuve et décisions) en parallèle de l’UI CRM seulement si les contrats partagés sont figés.
4. Lot 4 (matrice d’accès) avant d’activer les nouveaux biens en production.
5. Lot 5 (web agence, propriétaire, admin plateforme).
6. Lot 6, rapport de transition historique, validation manuelle et activation contrôlée.

Ne pas livrer le seul formulaire de sélection avant les contrôles API, ni activer le nouveau flux tant que les états de refus/rejet et les permissions d’accès provisoire ne sont pas couverts.
