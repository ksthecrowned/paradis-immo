# 14 — App mobile : correctifs et fonctionnalités transverses

## Objectif et rôles
Rendre l'app Expo fiable et complète :
- supprimer les écrans factices ;
- sécuriser les sessions ;
- gérer la pagination, l'upload et le hors-ligne ;
- ajouter les deep links ;
- offrir des espaces mobiles pour le propriétaire et l'agent.

Les fonctionnalités métier sont détaillées dans les specs 01 à 13. Ce fichier couvre ce qui est propre au client mobile.
Rôles : tous les utilisateurs de l'app. `OWNER`, `MANAGER` et `AGENT` reçoivent un nouvel espace dédié.

## État actuel (audit)
| Zone | Constat |
|---|---|
| `sale-inquiry` | Envoi **factice** (`setTimeout`, aucun appel API) |
| `book.tsx` | `bookingId` non transmis à l'écran de paiement, ce qui casse le flux de paiement de séjour |
| Annulations | `cancelBooking` et `cancelVisit` existent dans le client API mais **ne sont jamais appelés** dans l'UI |
| Sessions | Tokens stockés en **AsyncStorage** (en clair) |
| 360° | Vue « Visite 360° (bientôt) » factice |
| Onboarding | Écrans placeholder |
| Support | Écran stub |
| Contact | Uniquement par `tel:` |
| Upload | Aucun upload depuis le mobile (photos de ticket, pièces KYC, preuves de paiement, EDL) |
| Listes | Pas de pagination (charge la première page seulement) |
| Favoris | Chargement N+1 (un appel par bien) |
| Rôles | Pas d'espace propriétaire ni agent : l'app est réservée au chercheur, au locataire et au voyageur |
| Partage | Pas de deep link ni de lien universel |
| Hors-ligne | Aucun cache ni file d'attente : un EDL est impossible sans réseau |
| Versions | Pas de mise à jour forcée (`app/config` inexistant côté API) |
| Push | Enregistrement du token FCM sans modèle `UserDevice` multi-appareils (11) |

## User stories
1. En tant qu'acheteur, j'envoie une demande d'achat réelle et je la retrouve dans « Mes demandes » (08).
2. En tant que voyageur, je réserve puis je paie sans perdre ma réservation. J'annule ma réservation ou ma visite depuis l'app, selon la politique applicable (06, 07).
3. En tant qu'utilisateur, ma session est stockée de façon sécurisée. Je peux déverrouiller l'app par biométrie (option).
4. En tant qu'utilisateur, je découvre l'app via un onboarding de 3 écrans (rechercher, visiter, payer), puis je choisis mon profil (je cherche, je loue déjà, je gère des biens).
5. En tant qu'utilisateur, je partage une annonce. Le lien ouvre l'app si elle est installée, sinon la page web.
6. En tant qu'utilisateur, je fais défiler des listes longues sans limite (défilement infini, pull-to-refresh).
7. En tant que locataire, je joins des photos à un ticket de maintenance ou une preuve de paiement, depuis la caméra ou la galerie.
8. En tant que propriétaire, je consulte mes biens, mes revenus, mes relevés et les approbations en attente, et j'approuve ou je refuse depuis l'app (03).
9. En tant qu'agent, je consulte mon agenda de visites, je marque une visite effectuée ou non honorée, je remplis le compte rendu (06), je traite les tickets (09), je réponds aux messages (10) et je fais un état des lieux sur place (04).
10. En tant qu'agent, je réalise un EDL **sans réseau** (photos, relevés, signatures) et il se synchronise au retour de la connexion.
11. En tant qu'utilisateur, je suis averti quand une mise à jour est disponible, et bloqué si ma version n'est plus supportée.
12. En tant qu'utilisateur, je contacte le support par conversation in-app (10).
13. En tant qu'utilisateur, je choisis la langue (français, anglais, P2) et le thème clair ou sombre.

## Règles métier
- **Stockage sécurisé**
  - Le `refreshToken` va dans `expo-secure-store` (Keychain / Keystore). L'`accessToken` reste en mémoire seulement.
  - Migration au premier lancement : lire AsyncStorage, écrire dans SecureStore, puis purger AsyncStorage.
  - Biométrie (`expo-local-authentication`) en option, demandée au réveil après 5 minutes en arrière-plan.
- **Rafraîchissement** : un intercepteur unique avec mutex. Les requêtes concurrentes attendent le même refresh. Un échec du refresh déclenche la déconnexion locale et un écran de connexion avec un message (01).
- **Annulations** : l'UI affiche le montant remboursable calculé par l'API (`GET …/cancellation-quote`) avant confirmation (06, 07).
- **Pagination** : `useInfiniteQuery` (TanStack Query), `limit` à 20, seuil de chargement à 50 % de la fin.
- **Favoris** : un seul appel `GET users/me/favorites?include=property`, qui renvoie les biens embarqués (endpoint à ajouter ou à modifier côté API).
- **Upload**
  - `expo-image-picker` et `expo-camera`. Compression côté client (`expo-image-manipulator`) : largeur maximale de 2 048 px, JPEG à 0,8.
  - Envoi via presign R2 puis confirmation (même flux que le web), avec barre de progression et reprise en cas d'échec réseau.
- **Hors-ligne**
  - Cache de lecture TanStack Query persisté (MMKV) : 24 h pour les listes consultées, le bail et les paiements.
  - EDL et compte rendu de visite : brouillon local (SQLite) et file d'envoi.
    - Chaque mutation porte un `clientMutationId` (idempotence côté API).
    - Les photos sont mises en file et envoyées avant la mutation finale.
    - Conflit : le serveur fait foi si l'EDL a été signé ailleurs, et l'utilisateur est averti.
  - Bandeau « Hors ligne » global.
- **Deep links**
  - Schéma `paradisimmo://` et liens universels `https://<domaine>/p/:id`, `/v/:visitId`, `/b/:bookingId`, `/invite/:token` (02, 04 : invitations de bail et d'équipe).
  - Fichiers `apple-app-site-association` et `assetlinks.json` servis par `apps/web`.
  - Une notification push porte un `deepLink` (11).
- **Mise à jour forcée**
  - `GET app/config` → `{ minSupportedVersion, latestVersion, storeUrls, maintenanceMode, featureFlags }` (12).
  - Si la version est inférieure à `minSupportedVersion` : écran bloquant avec lien vers le store. Si elle est inférieure à `latestVersion` : bannière qu'on peut ignorer pendant 3 jours.
  - Mises à jour OTA via `expo-updates` pour les correctifs JS.
- **Espaces par rôle**
  - Le sélecteur de rôle actif (s'il y en a plusieurs) détermine la barre d'onglets.
    - Chercheur et locataire : Accueil, Recherche, Favoris, Messages, Profil.
    - Propriétaire : Biens, Revenus, Approbations, Messages, Profil.
    - Agent : Agenda, Tickets, Biens, Messages, Profil.
  - La création et l'édition complète d'annonces restent sur le web au départ (P2 mobile). Sur mobile, l'agent peut mettre à jour le statut, les photos et la disponibilité.
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
| POST | `sale-inquiries` | auth | Déjà existant côté API ; à brancher sur le mobile |
| GET | `bookings/:id/cancellation-quote` | voyageur | Montant remboursable |
| GET | `visits/:id/cancellation-quote` | visiteur | Idem |
| POST | `users/me/devices` / DELETE `users/me/devices/:token` | auth | Push (11) |
| — | En-tête `Idempotency-Key` / `clientMutationId` | auth | Accepté sur EDL, compte rendu de visite, ticket, preuve de paiement |
| GET | `me/dashboard?role=OWNER\|AGENT` | auth | Résumé pour l'accueil de l'espace (compteurs, prochaines échéances) |

## Écrans
- **Correctifs**
  - `sale-inquiry` : formulaire branché sur l'API, état d'envoi et d'erreur.
  - `book.tsx` → paiement : transmettre `bookingId`, reprendre un paiement en attente.
  - « Annuler » sur le détail de visite et de séjour, avec feuille de confirmation et montant remboursable.
  - 360° : visite virtuelle réelle (13) ou masquage du bouton.
  - Support → conversation SUPPORT (10).
- **Nouveaux écrans**
  - Onboarding de 3 écrans et choix du profil.
  - Écran de verrouillage biométrique.
  - Écran bloquant de mise à jour, bannière de mise à jour, écran de maintenance.
  - `profile/settings` : langue, thème, notifications (11), biométrie, appareils connectés (01), suppression du compte (01).
  - `profile/saved-searches` (13).
  - Composant `MediaPicker` réutilisable : ticket, KYC, preuves, EDL.
- **Espace propriétaire**
  - `owner/(tabs)` : biens (liste et statut), revenus (graphiques, relevés PDF), approbations (approuver ou refuser avec motif), détail d'un bien (bail en cours, tickets).
- **Espace agent**
  - `agent/(tabs)` : agenda (jour et semaine), détail de visite (check-in, compte rendu), tickets (assignation, statut, photos), biens (statut et disponibilité).
  - EDL hors-ligne guidé pièce par pièce, avec signatures sur place.

## Critères d'acceptation
- Après mise à jour, aucun token ne subsiste dans AsyncStorage. Le refresh token est lisible uniquement via SecureStore.
- 5 requêtes 401 simultanées déclenchent un seul appel `auth/refresh`.
- L'envoi d'une demande d'achat crée une `SaleInquiry` en base, visible côté agent.
- Une réservation créée puis payée depuis le mobile passe en CONFIRMED : `bookingId` est bien transmis.
- La liste de recherche charge les pages suivantes au défilement. La liste des favoris de 30 biens ne fait qu'un appel réseau.
- Un EDL réalisé en mode avion avec 20 photos se synchronise intégralement au retour du réseau, sans doublon (rejouer la mutation renvoie le même résultat).
- Un lien `https://<domaine>/p/:id` ouvre la fiche du bien dans l'app sur iOS et Android.
- Avec `minSupportedVersion` supérieure à la version installée, l'app affiche l'écran bloquant.
- Un utilisateur OWNER voit la barre d'onglets propriétaire et peut approuver une demande en attente.

## Priorité
- **P0** : `sale-inquiry` réel, `bookingId` dans `book.tsx`, SecureStore et mutex de refresh, `app/config` et mise à jour forcée.
- **P1** :
  - annulations visite et séjour dans l'UI ;
  - pagination et défilement infini ;
  - favoris sans N+1 ;
  - upload de médias (ticket, preuves) ;
  - deep links et partage ;
  - messagerie et support (10) ;
  - `UserDevice` ;
  - suppression du 360° factice ;
  - espace propriétaire (lecture et approbations) ;
  - espace agent (agenda, visites, tickets) ;
  - Sentry.
- **P2** : EDL hors-ligne et file de mutations, biométrie, onboarding et choix du profil, i18n anglais, thème sombre, édition d'annonces sur mobile, OTA, analytics produit.
