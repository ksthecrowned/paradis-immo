# 14 — App mobile client : correctifs et fonctionnalités transverses

## Objectif et rôles
Rendre l'app Expo destinée aux clients finaux (chercheurs, locataires, voyageurs et acheteurs) fiable et complète :
- supprimer les écrans factices ;
- sécuriser les sessions ;
- gérer la pagination, l'upload et le hors-ligne ;
- ajouter les deep links ;
- compléter les parcours client avant et après une visite, une location, un séjour, un achat ou un paiement.

Les fonctionnalités métier sont détaillées dans les specs 01 à 13. Ce fichier précise leur expérience mobile client. Le mobile ne sert pas de portail de gestion : les interfaces de propriétaires, gérants et agents restent sur le web ; aucun portail client web n'est prévu. Les clients finaux réalisent leurs parcours authentifiés dans l'application mobile.
Rôles inclus : `SEEKER`, `TENANT`, `GUEST` et `BUYER` (un même compte peut cumuler plusieurs situations). Les rôles `OWNER`, `MANAGER` et `AGENT` n'obtiennent pas d'espace de gestion mobile dans ce périmètre. Les prestataires externes n'ont pas d'accès direct au produit.

## État actuel (audit local, 2026-10-11)
### Déjà en place
- Tokens mobiles stockés dans SecureStore.
- Enregistrement des appareils, endpoint `app/config` côté API et aperçu d'annulation présents localement.
- Changements locaux dans les parcours de réservation et de demande de vente.
- Chargement des favoris avec les biens associés en cours localement.

### Écarts
- Le mobile n'utilise pas encore `app/config`.
- L'aperçu d'annulation des visites n'est pas disponible.
- Les favoris embarquant les biens restent à terminer et à vérifier de bout en bout.
- Les autres besoins transverses (pagination, uploads, liens profonds, hors-ligne, support, onboarding, écrans sécurité) restent à planifier par rapport aux specs métier.

### Complément d'audit du code mobile client (2026-10-16)
- `app/search.tsx` charge au plus 50 biens puis applique localement le texte et la majorité des filtres ; `lib/properties.ts` n'envoie à l'API qu'un sous-ensemble des filtres et n'expose pas de pagination exploitable dans ce parcours. Accueil, catégories et carte ont également une limite de 50 ; `app/(tabs)/discover.tsx` transforme une erreur de chargement en carte vide.
- `app/property/[id]/sale-inquiry.tsx` crée une demande avec message, budget et téléphone, mais n'offre pas le champ de financement. `app/purchases/[id].tsx` montre un statut succinct ; `app/achats/` correspond à un parcours distinct de compromis/vente par paliers. L'espace d'achat ne réunit donc pas encore demandes classiques, offres et suivi du compromis.
- `app/leases/` et `app/portfolio/[propertyId]/rent.tsx` couvrent principalement les baux existants. Aucun écran mobile de candidature longue durée ou de dossier candidat n'a été repéré, bien que ces parcours soient définis dans la spec 04.
- `app/payment/[id].tsx` indique que le paiement est initié, sans suivi de changement d'état dans cet écran ni accès visible au reçu. `app/stays/[id].tsx` affiche un séjour mais aucune action d'annulation ou de modification.
- La boîte de réception `app/notifications.tsx` liste les notifications et permet de les lire. En revanche, `app/(tabs)/index.tsx` affiche un point fixe et non un compteur ; le réglage `pushEnabled` de `app/profile/settings.tsx` est local et n'est pas consulté par `components/NotificationBootstrap.tsx` avant l'enregistrement push.
- `app/leases/[id]/maintenance/new.tsx` crée un ticket, mais aucun écran client de liste/détail/suivi n'a été repéré. L'entrée support du profil affiche un message « bientôt » ; les conditions et la politique de confidentialité de l'inscription ne sont pas accessibles depuis les liens actuellement commentés.
- « Mes biens » (`app/(tabs)/locations.tsx`) agrège des séjours, visites, achats et locations du client ; ce n'est pas un portefeuille de propriétaire. Son libellé peut laisser croire à un espace de gestion.
- `app/property/[id]/tour-360.tsx` est un carrousel d'images, pas une visite immersive 360° ; l'écran indique lui-même que l'expérience complète est à venir.

## User stories
1. En tant qu'acheteur, j'envoie une demande d'achat réelle et je la retrouve dans « Mes demandes » (08).
2. En tant que voyageur, je réserve puis je paie sans perdre ma réservation. J'annule ma réservation ou ma visite depuis l'app, selon la politique applicable (06, 07).
3. En tant qu'utilisateur, ma session est stockée de façon sécurisée. Je peux déverrouiller l'app par biométrie (option).
4. En tant que client, je découvre l'app via un onboarding de 3 écrans (rechercher, visiter, payer), puis je précise mon besoin client (chercher, louer, séjourner ou acheter).
5. En tant qu'utilisateur, je partage une annonce. Le lien ouvre l'app si elle est installée, sinon la page web.
6. En tant qu'utilisateur, je fais défiler des listes longues sans limite (défilement infini, pull-to-refresh).
7. En tant que locataire, je joins des photos à un ticket de maintenance ou une preuve de paiement, depuis la caméra ou la galerie.
8. En tant que client, je consulte mes dossiers de location, d'achat, de séjour et de visite dans un espace de suivi sans fonctions de gestion immobilière.
9. En tant qu'utilisateur, je suis averti quand une mise à jour est disponible, et bloqué si ma version n'est plus supportée.
10. En tant qu'utilisateur, je contacte le support par conversation in-app (10).
11. En tant qu'utilisateur, je choisis la langue (français, anglais, P2) et le thème clair ou sombre.

## Règles métier
- **Stockage sécurisé**
  - Le `refreshToken` va dans `expo-secure-store` (Keychain / Keystore). L'`accessToken` reste en mémoire seulement.
  - Migration au premier lancement : lire AsyncStorage, écrire dans SecureStore, puis purger AsyncStorage.
  - Biométrie (`expo-local-authentication`) en option, demandée au réveil après 5 minutes en arrière-plan.
- **Rafraîchissement** : un intercepteur unique avec mutex. Les requêtes concurrentes attendent le même refresh. Un échec du refresh déclenche la déconnexion locale et un écran de connexion avec un message (01).
- **Annulations** : le serveur décide de l'éligibilité et du remboursement. Pour les séjours, l'UI utilise `bookings/:id/cancellation-preview` (07) ; pour les visites, elle utilise les actions et `refundPercent` fournis dans `visit-bookings/mine` (06), sans inventer de montant côté client.
- **Pagination** : `useInfiniteQuery` (TanStack Query), `limit` à 20, seuil de chargement à 50 % de la fin.
- **Favoris** : un seul appel `GET users/me/favorites?include=property`, qui renvoie les biens embarqués (endpoint à ajouter ou à modifier côté API).
- **Upload**
  - `expo-image-picker` et `expo-camera`. Compression côté client (`expo-image-manipulator`) : largeur maximale de 2 048 px, JPEG à 0,8.
  - Envoi via presign R2 puis confirmation (même flux que le web), avec barre de progression et reprise en cas d'échec réseau.
- **Hors-ligne**
  - Cache de lecture TanStack Query persisté (MMKV) : 24 h pour les listes consultées, le bail et les paiements, avec date de dernière synchronisation visible.
  - Les brouillons client explicitement autorisés (par exemple une candidature non envoyée) sont conservés localement et synchronisés seulement après validation explicite de l'utilisateur.
  - Chaque mutation rejouable porte un `clientMutationId` (idempotence côté API) ; les pièces jointes sont mises en file et envoyées avant la mutation finale.
  - Aucun EDL, compte rendu de visite, traitement de ticket ou autre action de gestion n'est créé ou synchronisé par cette application client.
  - Bandeau « Hors ligne » global.
- **Deep links**
  - Schéma `paradisimmo://` et liens universels `https://<domaine>/p/:id`, `/v/:visitId`, `/b/:bookingId`, `/invite/:token` (02, 04 : invitations de bail et d'équipe).
  - Fichiers `apple-app-site-association` et `assetlinks.json` servis par `apps/web`.
  - Une notification push porte un `deepLink` (11).
- **Mise à jour forcée**
  - `GET app/config` → `{ minSupportedVersion, latestVersion, storeUrls, maintenanceMode, featureFlags }` (12).
  - Si la version est inférieure à `minSupportedVersion` : écran bloquant avec lien vers le store. Si elle est inférieure à `latestVersion` : bannière qu'on peut ignorer pendant 3 jours.
  - Mises à jour OTA via `expo-updates` pour les correctifs JS.
- **Navigation client uniquement**
  - Les onglets disponibles sont Découvrir, Favoris, Mon suivi et Profil (Accueil peut rester une entrée d'acquisition). Ils affichent les données et actions liées au compte client, sans KPI, revenus, portefeuille à administrer, approbations de mandat ou outils d'agence.
  - Si un compte possède aussi un rôle de gestion (`OWNER`, `MANAGER`, `AGENT`), l'app conserve le parcours client ; elle ne propose pas de bascule vers un espace de gestion dans ce périmètre.
- **Push** : enregistrement de `UserDevice` (plateforme, token, version de l'app, langue) à la connexion, suppression à la déconnexion (11).
- **Analytics et crash** : Sentry (crash et performance) et un analytics produit sans PII (écrans, entonnoirs recherche → visite → paiement), avec consentement (01).
- **Accessibilité** : `accessibilityLabel` sur toutes les icônes et tous les boutons, taille de police dynamique respectée, contraste AA.

## Modèle de données (côté API, complément)
```prisma
model UserDevice {          // défini en 11, rappel
  id          String   @id @default(cuid())
  userId      String
  platform    String   // ios | android | web
  pushToken   String   @unique
  appVersion  String?
  locale      String?
  lastSeenAt  DateTime @default(now())
}

model OfflineMutation {     // idempotence des envois hors-ligne
  clientMutationId String   @id
  userId           String
  endpoint         String
  resultRef        String?
  createdAt        DateTime @default(now())
}
```
Côté client : SQLite local (`drafts`, `upload_queue`, `mutation_queue`) et MMKV (cache des requêtes).

## Endpoints (ajouts ou modifications liés au mobile)
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `app/config` | public | Versions, maintenance, feature flags |
| GET | `users/me/favorites?include=property` | auth | Supprime le N+1 |
| GET | `sales/inquiries/my` | BUYER | Demandes d'achat du client (route existante ; compléter pour renvoyer les champs et historique requis) |
| POST | `sales/inquiries` | BUYER | Création de demande ; ajouter la prise en charge de `financing` côté API |
| GET | `bookings/:id/cancellation-preview` | GUEST | Montant remboursable (spec 07) |
| GET | `visit-bookings/mine` | SEEKER | Liste paginée avec `canCancel`, `canReschedule` et `refundPercent` (spec 06) |
| GET | `payments/:id/status` | payeur | Statut courant et interrogation fournisseur si le paiement est `INITIATED` (spec 05) |
| GET | `payments/:id/receipt` | payeur | Reçu du paiement validé, autorisé pour le payeur (route présente côté API) |
| GET | Catalogue/recherche paginée (route à aligner dans la spec 13) | public | Filtres complets, tri, curseur/total et annonces visibles |
| POST | `properties/:id/applications` ; GET `applications/mine` | SEEKER | Candidature et suivi (spec 04) |
| GET | `users/me/tenant-file` | auth | Dossier candidat et pièces réutilisables (spec 04) |
| GET | `sales/inquiries/my` ; GET `sales/offers/mine` | BUYER | Suivi des demandes et offres classiques (spec 08) |
| GET | `maintenance/tickets/my` ; GET `maintenance/tickets/:id` | déclarant | Liste et détail des tickets clients (spec 09) |
| GET | `notifications/unread-count` ; GET/PUT `users/me/notification-preferences` | auth | Badge et préférences effectives (spec 11) |
| POST | `users/me/devices` / DELETE `users/me/devices/:deviceId` | auth | Push (11) |
| — | En-tête `Idempotency-Key` / `clientMutationId` | auth | Mutations client rejouables concernées ; exclure les opérations réservées aux rôles de gestion |

## Écrans
- **Correctifs**
  - `sale-inquiry` : formulaire branché sur l'API, état d'envoi et d'erreur.
  - `book.tsx` → paiement : transmettre `bookingId`, reprendre un paiement en attente.
  - « Annuler » sur le détail de visite et de séjour, avec feuille de confirmation et montant remboursable.
  - 360° : visite virtuelle réelle (13) ou masquage du bouton.
  - Support → conversation SUPPORT (10).
- **Nouveaux écrans**
  - Onboarding de 3 écrans et choix d'un besoin client (chercher, louer, séjourner ou acheter).
  - Écran de verrouillage biométrique.
  - Écran bloquant de mise à jour, bannière de mise à jour, écran de maintenance.
  - `profile/settings` : langue, thème, notifications (11), biométrie, appareils connectés (01), suppression du compte (01).
  - `profile/saved-searches` (13).
  - Composant `MediaPicker` réutilisable : candidature/dossier locataire, ticket client et justificatif de paiement.
- Les espaces de gestion propriétaire et agent évoqués dans les anciennes versions de ce document sont hors périmètre mobile client ; leur interface reste spécifiée côté web.

## Critères d'acceptation
- Après mise à jour, aucun token ne subsiste dans AsyncStorage. Le refresh token est lisible uniquement via SecureStore.
- 5 requêtes 401 simultanées déclenchent un seul appel `auth/refresh`.
- L'envoi d'une demande d'achat crée une `SaleInquiry` en base, visible côté agent.
- Une réservation créée puis payée depuis le mobile passe en CONFIRMED : `bookingId` est bien transmis.
- La liste de recherche charge les pages suivantes au défilement. La liste des favoris de 30 biens ne fait qu'un appel réseau.
- Un brouillon de candidature interrompu par une perte réseau reste récupérable ; aucune candidature n'est envoyée avant confirmation explicite, et une nouvelle tentative ne crée pas de doublon.
- Un lien `https://<domaine>/p/:id` ouvre la fiche du bien dans l'app sur iOS et Android.
- Avec `minSupportedVersion` supérieure à la version installée, l'app affiche l'écran bloquant.
- Les parcours authentifiés d'un SEEKER, TENANT, GUEST ou BUYER sont accessibles dans l'app mobile ; aucune session ou page de portail client n'est disponible sur le web.

## Priorité
- **P0** : [x] stockage sécurisé des tokens ; [x] endpoint `app/config` et aperçu d'annulation ; [ ] consommer `app/config` et appliquer la mise à jour forcée.
- **P1** : [x] enregistrement des appareils et corrections locales de réservation/demande ; [ ] aperçu d'annulation des visites, pagination, favoris sans N+1, uploads et liens profonds. Les parcours clients détaillés en 14.6–14.11 sont également à terminer.
- **P2** : [ ] biométrie, onboarding, anglais, thème sombre, OTA et analytics.

## Delta d'implémentation
| ID | Priorité | Delta | État |
|---|---|---|---|
| 14.1 | P0 | Brancher `app/config` au mobile et appliquer la politique de version minimale. | À faire |
| 14.2 | P1 | Terminer favoris avec biens embarqués et aperçu d'annulation des visites. | Partiel / à faire |
| 14.3 | — | Les espaces de gestion propriétaire et agent restent sur le web et sont exclus du périmètre mobile client. | Hors périmètre |
| 14.4 | P1 | Compléter pagination, uploads, deep links, messagerie et autres parcours transverses. | À faire |
| 14.5 | P2 | Ajouter biométrie, onboarding client, i18n, thème, OTA et analytics. | À faire |

## Spécification détaillée des parcours client (complément 2026-10-16)

Les deltas 14.6–14.11 complètent les specs métier. Les règles de statut, d'autorisation, de montants et de remboursement restent définies dans les specs 04–11 ; l'app ne les recalcule pas et n'invente pas de transitions.

### 14.6 — Navigation client et libellé « Mes biens » (P1)

- Remplacer le libellé d'onglet et d'écran « Mes biens » par **« Mon suivi »**. Garder temporairement le chemin interne existant si nécessaire pour éviter une migration de liens, mais le titre, les libellés d'accessibilité et la navigation visible doivent employer le nouveau terme.
- « Mon suivi » est un agrégateur client, pas une liste de propriété. Il présente des entrées distinctes pour :
  - visites à venir et passées ;
  - réservations/séjours ;
  - demandes de location longue durée et baux actifs ;
  - demandes d'achat classiques et dossiers d'achat par paliers ;
  - loyers, paiements et échéances associés.
- Chaque entrée ouvre le détail de son objet métier ; les onglets/segments vides ont un texte et un CTA adaptés à la démarche concernée. Ne pas exposer les fonctions de gestion propriétaire/agent dans cette surface.
- Les compteurs agrégés ne doivent pas transformer un échec d'API en état vide ou en zéro : afficher l'erreur, conserver les données périmées si disponibles et proposer une reprise.

**Acceptation :** le parcours d'un utilisateur TENANT/BUYER/GUEST identifie clairement ses dossiers ; aucun écran présenté comme « Mes biens » ne suggère qu'il administre un portefeuille. Les deep links et notifications existants vers l'ancien chemin continuent d'ouvrir l'agrégateur.

### 14.7 — Recherche et découverte paginées (P1)

- La recherche doit être exécutée côté serveur avec les mêmes filtres visibles dans l'interface : texte, ville, quartier, mode (location longue durée, vente, courte durée), prix min/max, catégorie, nombre minimal de chambres/salles de bain, caractéristiques, disponibilité et ancienneté lorsqu'applicable.
- Ajouter pagination curseur ou offset, tri explicite (pertinence par défaut, puis prix/date selon choix utilisateur) et chargement à la demande. Une page contient au plus 20 résultats ; la limite ne doit pas tronquer silencieusement le catalogue.
- Les filtres restent synchronisés entre recherche, écran filtres, catégories et carte. Le nombre de résultats reflète toutes les pages selon le total renvoyé par l'API, ou indique clairement qu'il s'agit des résultats chargés.
- La carte charge les biens de la zone/viewport ou une liste paginée, et distingue explicitement : chargement, absence de résultats, erreur réseau et annonces sans coordonnées.
- État vide distinct d'une erreur ; bouton de nouvelle tentative sur toutes les surfaces ; pull-to-refresh conserve les filtres et réinitialise le curseur. Annuler une requête obsolète lors d'un changement de filtres.
- Les réponses de recherche ne contiennent que les annonces publiables et visibles à l'utilisateur ; la pagination et les filtres côté client ne constituent pas un contrôle d'autorisation.

**Contrat requis :** étendre l'API de catalogue/recherche (spec 13) pour accepter les filtres et le tri ci-dessus et renvoyer `items`, `nextCursor` ou `page/limit`, `hasMore` et, si disponible, `total`. Le client ne doit pas télécharger 50 annonces pour filtrer localement et prétendre fournir des résultats exhaustifs.

**Acceptation :** avec plus de 50 annonces correspondantes, l'utilisateur peut atteindre une annonce au-delà de la 50e ; chaque filtre appliqué modifie la requête serveur, et les résultats restent cohérents entre recherche et carte. Une panne API est visible et n'est pas affichée comme « aucun bien ».

### 14.8 — Candidature locative et dossier candidat (P1, spec 04)

- Ajouter `property/[id]/apply` pour les seules annonces `RENT_LONG` éligibles. Depuis la fiche, présenter « Postuler à la location » à côté de la réservation de visite ; masquer/désactiver l'action pour les annonces non disponibles ou d'un autre mode.
- Formulaire de candidature :
  - date d'emménagement souhaitée (obligatoire) ;
  - nombre d'occupants (obligatoire, entier positif) ;
  - profession/activité et revenus déclarés (selon le contrat de la spec 04) ;
  - message facultatif ;
  - pièces requises explicitement listées selon les types autorisés par l'API, sélectionnées dans caméra/galerie/fichiers, prévisualisables et téléversées en stockage privé ;
  - réutilisation contrôlée des pièces déjà présentes dans le dossier locataire ; afficher nom/type/date et demander confirmation avant de joindre chaque pièce.
- Fournir `profile/tenant-file` : création et édition du profil candidat et gestion des pièces réutilisables, avec état de vérification ; aucune URL publique permanente pour les pièces privées.
- Empêcher les doubles candidatures ouvertes sur le même bien ; si une candidature existe, ouvrir son suivi au lieu de proposer un second envoi. Brouillon local récupérable avant envoi. Afficher les erreurs de validation par champ.
- Ajouter `applications/mine` et `applications/[id]` : statut (`SUBMITTED`, `UNDER_REVIEW`, `SOLVENCY_PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`), bien concerné, date, prochaine action si fournie, message de rejet communiqué au candidat, documents joints et action de retrait uniquement si autorisée par le serveur.
- Une demande de solvabilité est présentée avec l'identité de l'organisation requérante, les données demandées, la finalité et la date d'expiration. Consentement/refus explicite ; le résultat n'est jamais visible avant consentement et ne montre au candidat que ses propres informations.
- Après acceptation, l'app indique que le bail est en préparation et relie le dossier au parcours de signature de bail de la spec 04. Elle ne crée pas elle-même un bail.
- Réutiliser les routes de la spec 04 (`POST properties/:id/applications`, `GET applications/mine`, `DELETE applications/:id`, `GET users/me/tenant-file`) et compléter si nécessaire les routes de mise à jour du dossier et de réponse à une demande de solvabilité. Aucun nouveau statut ni droit d'accès ne doit être défini seulement côté mobile.

**Acceptation :** un candidat peut remplir, joindre ses justificatifs, retrouver l'état de sa demande et consentir/refuser à une demande de solvabilité ; une pièce privée ne peut être lue que par ses destinataires autorisés. Un doublon ouvert est refusé côté API et l'interface ouvre le dossier existant.

### 14.9 — Achat classique, négociation et vente par paliers (P1, spec 08)

Deux parcours et leurs données doivent rester explicitement séparés :

1. **Demande d'achat classique** : la `SaleInquiry` de contact sur une annonce, son suivi, les offres et contre-offres.
2. **Dossier d'achat/compromis** : le `SaleAgreement` créé après acceptation d'une offre (ou créé par l'équipe selon le flux de vente), ses signatures, jalons et éventuel échéancier. Le paiement par paliers est une modalité de ce dossier, pas une demande distincte.

- Modifier le formulaire `property/[id]/sale-inquiry` pour recueillir le message (obligatoire, minimum 10 caractères), budget indicatif (facultatif), téléphone de contact (prérempli, modifiable), et mode de financement (`CASH`, `INSTALLMENTS`, `BANK_LOAN`) conformément à la spec 08. Valider côté serveur ; une demande ouverte existante est reprise plutôt que dupliquée.
- Créer un hub **Mes achats** avec des sections visuellement distinctes : **Demandes et négociations** (objets `SaleInquiry`/`SaleOffer`) et **Dossiers d'achat** (objets `SaleAgreement`, avec échéancier et paiement par paliers si applicable). Une demande convertie en compromis quitte la liste des demandes actives et ouvre le dossier correspondant ; ne pas dupliquer le même dossier entre sections.
- Compléter `sales/inquiries/my` et ajouter `sales/inquiries/[id]` si le détail n'est pas déjà embarqué : bien, message et coordonnées soumises, budget/financement, statut métier, dates de création et mise à jour, interlocuteur communiqué au client, prochaine action si disponible, dernier événement et fil chronologique. Le détail ne révèle aucune note interne ni donnée d'autres acheteurs.
- Dans le dossier classique, offrir la création d'une offre selon la spec 08 ; afficher prix, devise, financement, acompte, échéancier proposé, conditions, validité et statut. Présenter le fil des offres/contre-offres avec auteur, date, montant, conditions, échéance et décision. Permettre accepter/refuser/contre-proposer/retirer uniquement lorsque l'offre, l'utilisateur et le statut le permettent côté API ; confirmation avant décision irréversible.
- Lorsqu'une offre est acceptée, afficher le compromis issu du serveur, les signatures attendues, les échéances, les étapes de clôture, les documents disponibles et l'attestation de paiement intégral lorsqu'elle existe. Les signatures, montants, jalons et statut SOLD proviennent de l'API ; le mobile ne marque jamais un jalon comme achevé localement.
- Le dossier `SaleAgreement` conserve le parcours `achats/[id]` : échéancier si présent, statut, détail de chaque échéance, paiement de l'échéance éligible, état du paiement et reçu lié. Une demande de preuve de paiement garde son écran de consentement distinct.
- S'appuyer sur les API de la spec 08 (`sales/inquiries/my`, `properties/:id/offers`, `sales/offers/mine`, actions d'offre, compromis, documents, jalons et attestation). Compléter les contrats manquants avant l'écran si l'API n'expose pas les détails requis.

**Acceptation :** une `SaleInquiry` apparaît dans « Demandes et négociations » et jamais comme dossier signé ; après conversion, le `SaleAgreement` apparaît une seule fois dans « Dossiers d'achat », qu'il soit payable comptant ou par paliers. Les événements de négociation sont historisés et toute décision non permise est rejetée par l'API, sans fuite de notes internes.

### 14.10 — Paiements, justificatifs et cycle de séjour (P1)

- Après initiation Mobile Money, afficher un écran de suivi attaché à l'identifiant de paiement : états `INITIATED`, `PENDING_VALIDATION`, `VALIDATED`, `FAILED`, `EXPIRED`, `CANCELLED`, `DISPUTED`, `REFUNDED` et `PARTIALLY_REFUNDED` selon le modèle canonique de la spec 05 ; actualisation automatique à intervalle raisonnable, actualisation manuelle et fin du suivi quand l'état est terminal.
- L'écran détail du paiement affiche référence, montant/devise autorisés par le serveur, objet payé, date, moyen/opérateur, état, prochaine action et erreur réessayable sans créer de doublon. Pour `FAILED`/`EXPIRED`, proposer une reprise conforme à la règle d'idempotence du serveur ; ne pas réutiliser une clé si cela empêche une nouvelle tentative légitime.
- Rendre le reçu consultable/téléchargeable/partageable lorsqu'il est émis par l'API. S'il n'existe pas encore, indiquer « reçu en attente » plutôt que de présenter une confirmation d'initiation comme preuve de paiement.
- Historique paginé des paiements de visites, séjours, loyers et échéances de vente ; chaque paiement ouvre son détail. Aucun téléchargement de reçu ni donnée d'un autre payeur sans autorisation.
- Sur `stays/[id]`, exposer statut et détail tarifaire issus du serveur, arrivée/départ, conditions d'annulation, contact de l'hôte et actions permises. Ajouter annulation avec aperçu de remboursement côté serveur et confirmation ; ajouter modification de dates si l'API de la spec 07 le permet. Sinon, masquer l'action indisponible et proposer un contact support fonctionnel. Sur le détail de visite, afficher les actions permises et le remboursement communiqué par l'API avant confirmation (spec 06).
- Après annulation ou changement de dates, afficher le résultat confirmé par l'API et le remboursement associé ; ne pas déduire qu'un remboursement est terminé d'une simple demande acceptée.

**Acceptation :** après initiation, l'état final est reflété sans quitter/réouvrir l'écran ; le reçu n'est accessible qu'après son émission. L'annulation affiche le montant calculé par le serveur avant confirmation et le séjour reste dans l'historique avec son statut final.

### 14.11 — Notifications, maintenance, support et confiance (P1/P2)

- Le badge de notification de l'accueil affiche le nombre non lu renvoyé par l'API ; zéro signifie absence de badge. Supprimer le point rouge codé en dur. Rafraîchir le compteur à la connexion, au retour au premier plan, à la lecture individuelle/totale et après navigation depuis une notification.
- Le switch push pilote réellement la préférence serveur et la permission système :
  - désactivation : mettre à jour la préférence et arrêter l'enregistrement/envoi push selon les contrats de la spec 11 ; préserver les notifications in-app ;
  - réactivation : demander la permission native si nécessaire, puis enregistrer le device ; expliquer le refus système et fournir un lien vers les réglages si le système interdit une nouvelle demande ;
  - l'état affiché reflète la valeur persistée, avec retour arrière si la sauvegarde échoue. Ne pas confondre préférence locale, permission native et préférence de canal serveur.
- Ajouter préférences de notifications par catégorie/canal à partir du contrat canonique de la spec 11 ; ne pas offrir un réglage global qui désactive des notifications légalement/critiquement obligatoires. Le centre doit distinguer chargement, erreur, liste vide et données chargées.
- Ajouter `maintenance/my` et `maintenance/[id]` au parcours client (spec 09) : biens/baux éligibles, statut, urgence, date, description, photos, commentaires publics, changements de statut et prochaine étape. L'utilisateur peut ajouter une réponse/pièce jointe si les droits API le permettent ; les notes internes et devis non publiés restent invisibles.
- Remplacer le message provisoire du support par une conversation support fonctionnelle via la messagerie de la spec 10, avec création/récupération du fil, historique, envoi, états d'erreur et notifications. Si l'API n'est pas disponible, afficher des coordonnées support réellement configurées (appel/lien e-mail/WhatsApp) ; ne pas afficher « bientôt » comme si un service existait.
- Rendre accessibles depuis l'inscription et les réglages les conditions d'utilisation et la politique de confidentialité à la version en vigueur, avec version/date d'acceptation enregistrée. Ajouter l'accès à la suppression du compte conformément à la spec 01 : explication des conséquences, ré-authentification/confirmation, blocage ou traitement des obligations légales et retour de statut ; aucune suppression optimiste.
- Pour tous les écrans client : afficher les erreurs de chargement et actions de reprise, préserver les données déjà chargées au rafraîchissement, distinguer erreur de résultat vide et annoncer les erreurs de formulaire au lecteur d'écran.

**Acceptation :** le compteur correspond au centre de notifications ; changer la préférence push modifie la préférence effectivement utilisée par le serveur et ne supprime pas l'inbox. Le locataire peut consulter l'évolution d'un ticket, contacter le support par une voie fonctionnelle et accéder aux mentions légales ainsi qu'au parcours de suppression du compte.

### Critères transverses et ordre de livraison du complément

- Les listes client sont paginées côté serveur, avec états chargement/erreur/vide/fin de liste et rafraîchissement ; pas de limite arbitraire silencieuse à 50.
- Les actions sont idempotentes ou protégées contre le double tap ; les transitions métier et prix restent autoritaires côté API.
- Tester iOS et Android, utilisateur anonyme/connecté, SEEKER, TENANT, GUEST, BUYER, compte combinant plusieurs rôles, refus permission push, réseau interrompu, deep link et reprise de session.
- Tests ciblés couvrent les erreurs serveur, les listes de plus de deux pages, le rafraîchissement, les doubles soumissions, les états terminaux paiement/réservation, les permissions de documents privés et l'absence de données internes dans les vues client.

| ID | Priorité | Delta | État |
|---|---|---|---|
| 14.6 | P1 | Clarifier l'espace client « Mon suivi » et exclure les outils de gestion Owner/Agent du périmètre mobile. | À faire |
| 14.7 | P1 | Refaire recherche/carte avec filtres serveur, pagination, états d'erreur et cohérence du catalogue. | À faire |
| 14.8 | P1 | Ajouter candidature locative, dossier candidat, pièces privées et suivi/consentement solvabilité (spec 04). | À faire |
| 14.9 | P1 | Compléter le parcours achat classique de la demande à la négociation et distinguer les achats par paliers (spec 08). | Partiel |
| 14.10 | P1 | Suivre les statuts de paiement, reçus, annulation et changements de séjour (specs 05 et 07). | Partiel |
| 14.11 | P1 | Fiabiliser notifications/push et suivi maintenance ; rendre support, documents légaux et suppression du compte fonctionnels (specs 01, 09, 10, 11). | Partiel |
