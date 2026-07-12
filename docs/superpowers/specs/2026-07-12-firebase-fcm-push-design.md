# Mobile + API Firebase FCM push (no Expo fallback)

**Date:** 2026-07-12  
**Status:** Approved for implementation

## Goal

Deliver real Firebase Cloud Messaging push end-to-end: mobile obtains a native FCM/APNs device token, stores it on `User.fcmToken`, API sends via `firebase-admin`. No Expo Push Service. No silent “ok” when FCM is not configured.

## Scope

- API `FcmService` with `firebase-admin`
- Mobile permission → token → `PATCH /users/me { fcmToken }`
- Bootstrapping deep-link on notification tap
- Config wiring (`FCM_CREDENTIALS`, `google-services.json`, `GoogleService-Info.plist`)

## Out of scope

- SMS as push fallback
- Multi-device token list
- Marketing topics / campaigns

## Flow

1. Setup step or authenticated boot requests notification permission.
2. `getDevicePushTokenAsync()` → native FCM (Android) / APNs (iOS).
3. Persist token via existing `UpdateMeDto.fcmToken`.
4. Server events call `NotificationsService.send` → `FcmService.sendPush`.
5. Tap opens deep link via `resolveNotificationRoute`.

## Failure modes

| Case | Behavior |
|------|----------|
| No `FCM_CREDENTIALS` | `sendPush` → `{ ok: false, reason: 'NOT_CONFIGURED' }`, notification marked FAILED |
| Invalid / expired token | `{ ok: false, reason: 'INVALID_TOKEN' }`, clear `User.fcmToken` when FCM reports unregistered |
| Permission denied | No token saved; user can continue setup |
| Simulator / non-device | No token (expected) |

## Config

- API: `FCM_CREDENTIALS` = path to service-account JSON **or** raw JSON string
- Mobile: `apps/mobile/google-services.json`, `apps/mobile/GoogleService-Info.plist` (gitignored); referenced from `app.json`
