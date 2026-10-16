# Firebase / FCM (portail web)

Le portail Next.js enregistre le navigateur comme appareil `WEB` et reçoit les push via Firebase Cloud Messaging (même projet / service account que le mobile).

## Prérequis

1. Dans Firebase Console → Project settings → Your apps → **Add web app**.
2. Copier la config web dans `apps/web/.env.local` :

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Cloud Messaging → Web Push certificates → Key pair
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

3. Côté API : `FCM_CREDENTIALS` = JSON du **service account** Firebase (même projet). Sans ça, l’envoi push échoue en `NOT_CONFIGURED` (jamais de faux succès).

## Comportement

- Au chargement d’un shell dashboard (`owner` / `agent` / `admin`), `WebPushBootstrap` demande la permission navigateur, obtient un token FCM, puis :
  - `PATCH /users/me` avec `fcmToken` + `notificationChannel: PUSH`
  - `POST /notifications/devices` avec `platform: WEB`
- Au logout : `DELETE /notifications/devices/:deviceId`
- Clic sur une notification système → `/notifications` (redirige vers le centre du rôle)
- Sans les variables `NEXT_PUBLIC_FIREBASE_*`, le bootstrap est no-op (inbox in-app reste disponible)

## Notes

- HTTPS (ou `localhost`) requis pour Notification API + service worker.
- Le service worker est servi via rewrite `/firebase-messaging-sw.js` → `/api/firebase-messaging-sw`.
- Activer les notifications navigateur bascule la préférence de livraison du compte sur **PUSH** (plus WhatsApp par défaut). Les lignes inbox restent créées dans tous les cas.
