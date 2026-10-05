# 10 — Messagerie in-app

## Objectif et rôles
Remplacer le contact uniquement par `tel:` par une messagerie in-app traçable, rattachée aux objets métier (annonce, visite, bail, séjour, vente, ticket). Les numéros personnels ne sont plus exposés et l'historique est conservé pour les litiges.
Rôles : tous. Une conversation réunit un ou plusieurs « côtés » : client, d'une part ; agence ou propriétaire, d'autre part.

## État actuel (audit)
- Aucun modèle `Conversation` ou `Message`. Le dossier `messaging/` ne contient que `infobip-sms.service.ts`, utilisé pour l'envoi de SMS sortants.
- Mobile : le contact passe uniquement par `tel:`. L'écran support est un stub.
- Web : aucune boîte de réception.

## User stories
1. En tant que chercheur, depuis une annonce, je clique « Envoyer un message ». Une conversation s'ouvre avec l'agence gestionnaire, ou avec le propriétaire en l'absence de mandat, et l'annonce est épinglée en contexte.
2. En tant que locataire, j'écris à mon gestionnaire depuis mon bail. En tant que voyageur, j'écris à l'hôte depuis ma réservation.
3. En tant qu'agence, tous les membres autorisés sur le bien voient la conversation (boîte partagée). Je l'assigne à un agent, et le client voit « Répondu par Paul (Agence X) ».
4. J'envoie du texte, des photos, des PDF (5 fichiers par message au maximum, 10 Mo chacun) et des messages vocaux (P2).
5. Je vois les accusés de lecture (lu ou non lu) et l'indicateur « en train d'écrire ».
6. Je reçois une notification push. Si je ne lis pas sous 30 minutes, je reçois un rappel par WhatsApp ou SMS selon ma préférence (11).
7. En tant qu'agence, j'utilise des réponses rapides (modèles) : horaires de visite, documents demandés, etc.
8. Je signale un message abusif ; l'admin le modère. Je bloque un utilisateur.
9. En tant que support Paradis Immo, j'ai une conversation « Support » avec chaque utilisateur, ce qui remplace l'écran support stub.
10. En tant qu'admin, j'accède à une conversation dans le cadre d'un litige (accès journalisé).

## Règles métier
- **Unicité** : une conversation par (`contextType`, `contextId`, client). Ouvrir à nouveau depuis le même contexte réutilise la conversation.
  - `contextType` : `PROPERTY`, `VISIT`, `LEASE`, `BOOKING`, `SALE`, `MAINTENANCE`, `SUPPORT`.
- **Participants**
  - Côté client : l'utilisateur, plus les colocataires pour un bail.
  - Côté gestion : membres résolus dynamiquement via `AgencyAccessService` au moment de la lecture. Un agent retiré du mandat perd l'accès, et l'historique reste visible pour l'agence.
  - Le propriétaire avec un bien sous mandat voit les conversations LEASE et MAINTENANCE en lecture seule, s'il active l'option.
- **Masquage des coordonnées** : les numéros de téléphone et e-mails saisis dans les messages d'un contexte PROPERTY sont masqués tant qu'aucune visite n'est confirmée et qu'aucune candidature ou offre n'existe. Cela limite le contournement de la plateforme, et chaque organisation peut l'activer ou non.
- **Temps réel**
  - WebSocket (gateway NestJS, namespace `/messaging`, JWT au handshake). Repli sur le polling `GET …/messages?after=`.
  - Événements serveur : `message.created`, `message.read`, `typing`.
- **Pièces jointes** : stockage R2 privé, URL signée de 10 minutes. Antivirus optionnel (P2). Types autorisés : images, PDF, audio m4a.
- **Rétention** : messages conservés 3 ans après la clôture du contexte. Ils ne peuvent pas être édités ; suppression possible par l'auteur sous 5 minutes (le message devient « Message supprimé »).
- **Rate limit** : 30 messages par minute et par utilisateur, 200 conversations nouvelles par jour.
- **Blocage** : un utilisateur bloqué ne peut plus ouvrir de conversation de contexte PROPERTY avec l'organisation. Les contextes contractuels (bail, vente) restent ouverts.
- **Notification**
  - Push immédiat, sauf si le destinataire est connecté sur la conversation.
  - Relance par canal externe à +30 minutes si le message n'est pas lu, une seule fois par conversation et par fenêtre de 6 h.
- **Événements** : `MESSAGE_CREATED`, `CONVERSATION_ASSIGNED`, `MESSAGE_REPORTED`.

## Modèle de données
```prisma
enum ConversationContext { PROPERTY VISIT LEASE BOOKING SALE MAINTENANCE SUPPORT }
enum ConversationStatus { OPEN ARCHIVED CLOSED }

model Conversation {
  id              String              @id @default(cuid())
  contextType     ConversationContext
  contextId       String?
  propertyId      String?
  clientUserId    String
  organizationId  String?             // côté gestion (agence ou org propriétaire)
  assignedToId    String?
  status          ConversationStatus  @default(OPEN)
  lastMessageAt   DateTime?
  lastMessagePreview String?
  createdAt       DateTime            @default(now())
  messages        Message[]
  reads           ConversationRead[]
  @@unique([contextType, contextId, clientUserId])
  @@index([organizationId, lastMessageAt])
  @@index([clientUserId, lastMessageAt])
}

model Message {
  id             String    @id @default(cuid())
  conversationId String
  senderId       String?   // null = système
  body           String?
  kind           String    @default("TEXT") // TEXT | ATTACHMENT | SYSTEM | AUDIO
  attachments    Json?     // [{ fileKey, mimeType, size, name }]
  maskedBody     String?
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  @@index([conversationId, createdAt])
}

model ConversationRead { conversationId String userId String lastReadAt DateTime lastReadMessageId String? @@id([conversationId, userId]) }

model QuickReply { id String @id @default(cuid()) organizationId String title String body String }

model UserBlock { blockerId String blockedUserId String organizationId String? createdAt DateTime @default(now()) @@id([blockerId, blockedUserId]) }

model MessageReport { id String @id @default(cuid()) messageId String reporterId String reason String status String @default("OPEN") createdAt DateTime @default(now()) }
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `conversations` | auth | `{ contextType, contextId }` : crée ou retrouve |
| GET | `conversations` | auth | Mes conversations (client), paginées, avec compteur de non-lus |
| GET | `conversations/managed` | gestionnaire | Boîte partagée, filtres `assignedTo`, `propertyId`, `unread`, `contextType` |
| GET | `conversations/:id` | participant | Détail et contexte |
| GET | `conversations/:id/messages` | participant | `?before&after&limit` |
| POST | `conversations/:id/messages` | participant | `{ body?, attachments? }` |
| POST | `conversations/:id/attachments/presign` | participant | Upload R2 |
| POST | `conversations/:id/read` | participant | `{ messageId }` |
| PATCH | `conversations/:id` | gestionnaire | `{ assignedToId, status }` |
| DELETE | `messages/:id` | auteur | Sous 5 minutes |
| POST | `messages/:id/report` | participant | |
| POST | `users/:id/block` / DELETE | auth | |
| CRUD | `organizations/:id/quick-replies` | gestionnaire | |
| GET | `conversations/unread-count` | auth | Badge |
| WS | `/messaging` | auth | `join(conversationId)`, `typing`, events |

## Écrans
- **Mobile**
  - Onglet « Messages » : liste avec badges et aperçu.
  - Écran de conversation : bulles, pièces jointes, caméra, accusés de lecture, carte de contexte cliquable.
  - CTA « Message » sur l'annonce, la visite, le bail, le séjour, la vente et le ticket, à côté de « Appeler ».
  - Support : conversation SUPPORT, en remplacement du stub.
- **Web, agent et owner**
  - `/agent/inbox` et `/owner/inbox` : vue en 3 colonnes (liste, conversation, panneau de contexte avec le bien et l'objet lié), assignation, réponses rapides.
  - Badge de non-lus dans la `topbar`.
- **Admin** : `/admin/support` (conversations SUPPORT) et `/admin/moderation/messages` (signalements).

## Critères d'acceptation
- Ouvrir deux fois une conversation depuis la même annonce renvoie la même conversation.
- Un agent assigné au mandat voit la conversation. Après retrait du mandat, il reçoit 403.
- Un message envoyé apparaît chez l'autre participant connecté en moins de 2 s via WebSocket.
- Un numéro « 06 123 45 67 » dans un premier message PROPERTY est masqué pour le destinataire si l'option est active.
- Un message non lu à +30 minutes déclenche un seul rappel WhatsApp ou SMS.
- L'URL d'une pièce jointe expire au bout de 10 minutes. Un non-participant reçoit 403.
- L'accès admin à une conversation crée une entrée d'audit (12).

## Priorité
- **P1** : conversations contextuelles, boîte partagée de l'agence, pièces jointes, push et non-lus, support in-app.
- **P2** : temps réel WebSocket (le polling suffit pour un MVP), masquage des coordonnées, réponses rapides, blocage et signalement, messages vocaux, relance par canal externe.
