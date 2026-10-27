# MOBILE_SETUP.md

How to build, run and connect the iOS and Android apps. They wrap the same web build with Capacitor 8 (ADR-050): everything you can do in the browser also runs in the apps, plus the native extras below.

> Status: the projects (`ios/`, `android/`), the native adapters and Sift's own lock-screen plugin are in the repo and CI builds both apps (`.github/workflows/ci.yml`: a debug APK and an iOS simulator build). What only you can do: signing, the Firebase project for push, the link domain, store listings. Each step below says what to change.

## 0. What is where

| Thing | Where |
|---|---|
| App id, name, plugin options | `capacitor.config.ts` (`com.mirecodes.sift`; change it before the first store upload, never after) |
| iOS project | `ios/App/App.xcodeproj` (Swift Package Manager, no CocoaPods) |
| Android project | `android/` (Gradle, Java 21) |
| Lock-screen plugin | `ios/App/App/LiveProgressPlugin.swift`, `ios/App/SiftLiveActivity/`, `android/app/src/main/java/com/mirecodes/sift/LiveProgressPlugin.java` |
| JS side of every native feature | `src/platform/native/index.ts` |
| iOS privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` |

## 1. Tools

- Node 22+ and `npm ci` (as for the web app).
- iOS: a Mac with Xcode 26 or newer (Capacitor 8), an Apple Developer account for devices and the App Store.
- Android: Android Studio (recent), JDK 21, an Android SDK with platform 36.

## 2. Build and run

```bash
npm run mobile:sync          # web build into dist/, then copied into both apps (cap sync)
npm run mobile:ios           # opens Xcode → pick a simulator or device → Run
npm run mobile:android       # opens Android Studio → Run
```

Run `npm run mobile:sync` again after every web change. For a quick device check of web-only changes you can also point the app at your dev server: add `server: { url: 'http://<your-LAN-IP>:5173', cleartext: true }` to `capacitor.config.ts` temporarily (never commit it).

Backend: the app uses `config/app.yaml` `backend.*` like the web build (see `BACKEND_SETUP.md`). With `provider: fake` the test server runs inside the app.

## 3. Signing

- **iOS**: Xcode → App target → Signing & Capabilities → your Team; "Automatically manage signing". For the Live Activity extension (§5) do the same on its target.
- **Android debug**: signed with the debug key automatically (CI uploads `app-debug.apk`).
- **Android release**: create an upload key (`keytool -genkey -v -keystore sift-upload.jks -alias sift -keyalg RSA -keysize 2048 -validity 10000`), keep it outside the repo, and add a `signingConfigs.release` block in `android/app/build.gradle` reading the passwords from `~/.gradle/gradle.properties`. Use Play App Signing.
- **CI release builds** (optional, later): store the keystore (base64) and passwords, or the Apple certificate and provisioning profile, as GitHub secrets and add a release job. Not set up yet.

## 4. Icons and splash

The projects carry Capacitor's default icon and splash. To make Sift's:
1. Put a 1024×1024 `assets/icon.png` (no transparency for iOS) and a 2732×2732 `assets/splash.png` (centered logo on `#080808`) in the repo.
2. `npx @capacitor/assets generate --iconBackgroundColor '#080808' --splashBackgroundColor '#080808'`
3. Commit the generated files under `ios/` and `android/`.
The Android status bar icon for notifications is `android/app/src/main/res/drawable/ic_stat_sift.xml` (white shape, Android tints it).

## 5. Lock-screen timer (Step 6.8, ADR-049)

Android needs nothing more. iOS needs a Widget Extension once:
1. Xcode → File → New → Target → **Widget Extension**, name `SiftLiveActivity`, check **Include Live Activity**, uncheck Configuration Intent. Activate the scheme if asked.
2. Delete the template Swift files Xcode created in the new target, then add `ios/App/SiftLiveActivity/SiftLiveActivity.swift` to the `SiftLiveActivity` target.
3. Select `ios/App/App/LiveProgressAttributes.swift` → File inspector → Target Membership → tick **both** `App` and `SiftLiveActivity`.
4. Set the extension's deployment target to iOS 16.2. `NSSupportsLiveActivities` is already in the app's `Info.plist`.
5. Run on a device (Live Activities need iOS 16.2+; the simulator works too), start a focus, lock the screen.

Check on a device: the countdown, the "Time's up" line with overtime counting up after the planned end, the break disappearing on its own at its end, and Settings › Lock screen timer turning it off.

## 6. Timer notifications (Step 6.3)

Nothing to set up. The app asks for notification permission at the first Focus start (the end alert is what it is for). Android 12+: exact timing needs the "Alarms & reminders" permission; without it Android may deliver the alert a little late. Sound follows Settings › Sound (Android channels `timer` and `timer_silent`).

## 7. Push (Step 6.6)

Push goes through Firebase Cloud Messaging for both platforms. Until you do this, push is simply off (social events still wait in the Inbox).

1. Create a Firebase project (https://console.firebase.google.com), add an **iOS app** (bundle id `com.mirecodes.sift`) and an **Android app** (package `com.mirecodes.sift`).
2. Download `GoogleService-Info.plist` → add it to `ios/App/App/` in Xcode (App target). Download `google-services.json` → put it in `android/app/`. Both may be committed (they are not secrets) or provided by CI.
3. iOS: Apple Developer → Keys → create an **APNs key**; upload it in Firebase → Project settings → Cloud Messaging → Apple app configuration. In Xcode add the capabilities **Push Notifications** and **Background Modes → Remote notifications** (the plist entry is already there).
4. Server: Firebase → Project settings → Service accounts → **Generate new private key**. Store the whole JSON as a Supabase secret: `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)" --workdir server`, then redeploy the function (`BACKEND_SETUP.md`).
5. Test: sign in on a phone, send yourself a friend request from a second account (Phase 7) while the phone is not focusing; you should get a push. While focusing you should not (it waits in the Inbox).

What the server sends and when: `server/core/push.ts` (`planPushes`). Categories (Settings › Notifications) are stored per device with `register_device`.

## 8. Deep links (Step 6.5)

Links look like `https://<domain>/join/<CODE>`, `/add/<name>-<tag>`, `/war/<id>`. Pick the domain that serves the web app (e.g. `sift.example.com`), then:

1. **Web host**: serve `index.html` for `/join/*`, `/add/*`, `/war/*` (SPA fallback). The web app reads the link once and returns to `/`.
2. **Android**: set `siftLinkHost=<domain>` in `android/gradle.properties`. Host `https://<domain>/.well-known/assetlinks.json`:
   ```json
   [{ "relation": ["delegate_permission/common.handle_all_urls"],
      "target": { "namespace": "android_app", "package_name": "com.mirecodes.sift",
                  "sha256_cert_fingerprints": ["<SHA-256 of your signing key; Play Console → App integrity>"] } }]
   ```
3. **iOS**: Xcode → Signing & Capabilities → **Associated Domains** → `applinks:<domain>`. Host `https://<domain>/.well-known/apple-app-site-association` (no extension, `application/json`):
   ```json
   { "applinks": { "details": [{ "appIDs": ["<TEAMID>.com.mirecodes.sift"],
                                  "components": [{ "/": "/join/*" }, { "/": "/add/*" }, { "/": "/war/*" }] }] } }
   ```
4. Phones without the app open the web app; a store-badge banner for them comes with the store listings.

## 9. Before the stores

See `STORE_READINESS.md` (privacy labels, data safety, age rating, review notes).
