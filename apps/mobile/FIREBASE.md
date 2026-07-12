# Firebase / FCM (mobile)

Push uses **native FCM/APNs tokens** via `expo-notifications` (`getDevicePushTokenAsync`). No Expo Push Service.

## Files to add (gitignored)

1. Download from Firebase Console → Project settings → Your apps:
   - Android → `google-services.json` → place at `apps/mobile/google-services.json`
   - iOS → `GoogleService-Info.plist` → place at `apps/mobile/GoogleService-Info.plist`
2. Package / bundle IDs must match:
   - Android: `com.paradisimmo.mobile`
   - iOS: as configured in Xcode / `app.json`
3. Rebuild a **dev client or store build** (`expo prebuild` / EAS). Expo Go does not receive your FCM project tokens.

## API

Set `FCM_CREDENTIALS` on the Nest API to a Firebase **service account** JSON path (or raw JSON). Server sends with `firebase-admin`; missing credentials → push marked failed (`NOT_CONFIGURED`), never a fake success.

## Platform notes

- **Android:** `getDevicePushTokenAsync()` returns an FCM token once `google-services.json` is in the native build.
- **iOS:** Expo returns an APNs device token by default. Firebase Admin `send({ token })` expects an **FCM registration token**. For production iOS push via FCM, add `@react-native-firebase/messaging` (or an equivalent) in a follow-up so the device registers an FCM token; upload your APNs key in the Firebase console either way.
- Physical device required; rebuild after adding the Google config files (`npx expo prebuild` / EAS).
