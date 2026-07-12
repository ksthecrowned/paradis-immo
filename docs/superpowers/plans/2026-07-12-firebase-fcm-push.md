# Firebase FCM push implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Firebase push (mobile token + API firebase-admin), no Expo Push fallback.

**Architecture:** Expo Notifications for permission/token/listeners; Nest `FcmService` sends via Admin SDK; token on `User.fcmToken`.

**Tech Stack:** firebase-admin, expo-notifications, existing `PATCH /users/me`.

---

### Task 1: API FcmService with firebase-admin

**Files:**
- Modify: `apps/api/src/notifications/fcm.service.ts`
- Create: `apps/api/src/notifications/fcm.service.spec.ts`
- Modify: `apps/api/package.json` (add `firebase-admin`)
- Modify: `apps/api/.env.example`, `.env.example`

- [ ] Install `firebase-admin`
- [ ] Implement init from `FCM_CREDENTIALS` (file path or JSON)
- [ ] `sendPush` real `messaging().send`; no fake ok
- [ ] Unit tests with mocked messaging

### Task 2: Mobile Firebase + bootstrap

**Files:**
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/lib/notifications.ts`
- Create: `apps/mobile/components/NotificationBootstrap.tsx`
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/.gitignore`

- [ ] Point `android.googleServicesFile` / iOS plist in app.json
- [ ] Harden token registration (errors, Android channel)
- [ ] Bootstrap: register token when authed + listen for taps
- [ ] Gitignore credential files

### Task 3: Clear stale tokens on INVALID_TOKEN

**Files:**
- Modify: `apps/api/src/notifications/notifications.service.ts` (and/or FcmService callback)

- [ ] When FCM returns unregistered/invalid, null out `user.fcmToken`
