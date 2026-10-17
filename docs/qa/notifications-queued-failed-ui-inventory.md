# Inventaire UI — statuts d'envoi `QUEUED` / `FAILED`

Inventaire des écrans et composants web/mobile qui consomment l'inbox notifications, après fiabilisation API (`QUEUED` + `retryAfter`, `FAILED` + `attempts`/`lastError`). **Aucune UI livrée ici** : ce document fixe les écarts pour une future tâche d'affichage.

Date d'audit : 2026-10-17. Source de vérité : code sous `apps/web`, `apps/mobile`, `apps/api/src/notifications/`.

## Contrat API (rappel)

`GET /notifications/my` renvoie déjà `PublicNotification` avec :

| Champ | Présent API | Typé côté clients |
|---|---|---|
| `status` | oui (`PENDING` \| `QUEUED` \| `SENT` \| `FAILED`) | oui, mais `string` non discriminant |
| `attempts`, `lastError`, `retryAfter` | oui (télémétrie retry) | **non** sur web ni mobile |
| `readAt` | oui | oui → dérivé `read: boolean` |

Les clients mappent uniquement lu/non-lu ; `status` et la télémétrie retry sont ignorés après fetch.

## Principes UX à respecter (hors implémentation)

- Distinguer **liste vide** (aucune notification) d’**erreur de chargement** (déjà partiellement fait).
- Distinguer **échec d’envoi** (`FAILED`) d’**échec métier** dans le contenu (ex. type `PAYMENT_FAILED`).
- Ne pas annoncer un envoi réussi tant que `status` n’est pas terminal réussi (`SENT`).
- Ne pas exposer de secrets (`lastError` peut être technique : le filtrer côté UI future).

---

## Web

### Types / mapping partagés

| Chemin | Affiche aujourd’hui | `QUEUED`/`FAILED` typés / utilisés | Écart |
|---|---|---|---|
| `apps/web/lib/notifications.ts` | `PublicNotification.status: string` ; `NotificationView` = titre, corps, heure, **`read` uniquement**, href, icône | `status` présent sur le DTO brut ; **non propagé** dans `NotificationView` ; pas de `attempts` / `lastError` / `retryAfter` | Étendre le type vue + `mapNotification` pour porter le statut d’envoi (et éventuellement retry) ; union/enum alignée sur l’API |

### Centres de liste (même composant)

| Chemin | Affiche aujourd’hui | Statut envoi | Écart |
|---|---|---|---|
| `apps/web/components/notifications/notifications-center.tsx` | Liste groupée par jour ; filtres Toutes / Non lues ; pastille non-lue ; marquer lu / tout lire ; bannière d’erreur API ; empty state si liste vide | Aucun badge / filtre / libellé `QUEUED` ou `FAILED` | Afficher état d’envoi par ligne (ex. « En file », « Échec d’envoi ») ; ne pas confondre empty et erreur (aujourd’hui erreur + empty peuvent coexister) ; filtre optionnel « échecs » |
| `apps/web/app/owner/notifications/page.tsx` | Wrapper → `NotificationsCenter` `role="owner"` | hérité | idem |
| `apps/web/app/agent/notifications/page.tsx` | Wrapper → `NotificationsCenter` `role="agent"` | hérité | idem |
| `apps/web/app/admin/notifications/page.tsx` | Panneau ops Échecs/relance (`FAILED`/`QUEUED`, filtres, Relancer) via `lib/admin/notifications.ts` | Oui (liste admin) | Modèles / Stats (spec 12) encore absents ; l’inbox perso admin n’est plus sur cette route |

### Topbar

| Chemin | Affiche aujourd’hui | Statut envoi | Écart |
|---|---|---|---|
| `apps/web/components/dashboard/notifications-dropdown.tsx` | Aperçu (8) ; badge non-lus ; lu / tout lire ; erreur vs empty séparés ; lien préférences | Aucun | Réutiliser le mapping statut ; pastille/libellé pour `QUEUED`/`FAILED` dans l’aperçu |
| `apps/web/components/dashboard/topbar.tsx` | Monte `NotificationsDropdown` | — | Pas de changement structurel au-delà du dropdown |

### Redirection / préférences (hors inbox livraison)

| Chemin | Affiche aujourd’hui | Statut envoi | Écart |
|---|---|---|---|
| `apps/web/app/notifications/page.tsx` | Redirect rôle → `/{role}/notifications` | N/A | Aucun (pas de liste) |
| `apps/web/app/profile/notifications/page.tsx` + `apps/web/components/profile/profile-notifications.tsx` | Préférence canal PUSH / WhatsApp | N/A | Hors périmètre statut d’envoi ; pas de gap `QUEUED`/`FAILED` |

---

## Mobile

### Types / mapping

| Chemin | Affiche aujourd’hui | `QUEUED`/`FAILED` typés / utilisés | Écart |
|---|---|---|---|
| `apps/mobile/lib/inbox-notifications-types.ts` | `status: string` ; pas de `attempts` / `lastError` / `retryAfter` | `status` typé faiblement ; télémétrie absente | Aligner sur `PublicNotification` API |
| `apps/mobile/lib/inbox-notifications-map.ts` | `InboxNotificationView` = kind, titre, corps, heure, **`read`**, deep link | `status` **ignoré** dans `mapInboxNotification` | Propager statut (+ retry si besoin UX) |
| `apps/mobile/lib/inbox-notifications.ts` | Fetch `/notifications/my`, mark read | Passe le DTO brut sans enrichir | Suite du mapping |

### Écran inbox

| Chemin | Affiche aujourd’hui | Statut envoi | Écart |
|---|---|---|---|
| `apps/mobile/app/notifications.tsx` | Liste FlatList ; non-lu (style + pastille) ; tout lu ; bannière erreur + réessayer ; empty « Aucune notification » | Aucun | Badge/libellé `QUEUED`/`FAILED` ; si erreur API, éviter de ne montrer que l’empty sans contexte (bannière déjà présente — garder la distinction) |

### Hors liste (pas d’affichage de statut d’envoi)

| Chemin | Rôle | Écart `QUEUED`/`FAILED` |
|---|---|---|
| `apps/mobile/lib/notifications.ts` | Push token, permission, deep-link tap | N/A (pas d’inbox) |
| `apps/mobile/components/NotificationBootstrap.tsx` | Enregistrement FCM + navigation push | N/A |
| `apps/mobile/lib/notification-routes.ts` | Résolution deep links | N/A |
| `apps/mobile/app/(tabs)/index.tsx` | Bouton cloche → `/notifications` (badge décoratif, pas de compteur API) | Hors inventaire statut ; compteur non-lus lié ailleurs (spec 14) |

---

## Surfaces absentes (spécifiées, non présentes dans le code audit)

| Surface (specs 11 / 12) | État code | Lien avec `QUEUED`/`FAILED` |
|---|---|---|
| Admin `/admin/notifications` **Échecs** + retry | **Livré** (2026-10-17) : `GET /admin/notifications/failed`, `POST /admin/notifications/:id/retry`, UI filtres + Relancer | Ops OK pour `FAILED`/`QUEUED` ; restent Modèles / Stats |
| Admin onglets Modèles / Stats | Non | Hors statut d’envoi inbox utilisateur |
| Filtres catégorie / pagination centres (delta 11.2) | Non | Indépendant mais utile pour isoler les échecs |

---

## Synthèse des gaps (priorité UX)

1. **Mapping client** (web + mobile) : `status` + télémétrie retry non portés dans les vues inbox **utilisateur**.
2. **Inbox utilisateur** (web center + dropdown + mobile liste) : affichage lu/non-lu seulement ; pas d’indication « en file » / « échec d’envoi ».
3. **Admin supervision** : Échecs/relance **livrés** ; Modèles / Stats encore ouverts (spec 12).
4. **Préférences / bootstrap push** : hors scope statut d’envoi.

Inventaire à jour pour le panneau admin failed/retry ; les inbox owner/agent/mobile ne reflètent toujours pas `QUEUED`/`FAILED`.
