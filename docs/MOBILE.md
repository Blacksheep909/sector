# SECTOR on phones and tablets

SECTOR plays in landscape on phones and tablets (touch controls: drag to pan, pinch to zoom, tap to select and order, hold for a hex's details). Every game needs a **SECTOR server**: Sector.exe on a PC, or a hosted server. The phone is a screen and controller for it. There are three ways to put SECTOR on a phone, from zero effort to app stores.

## 1. In the browser (works today)

Open the server's address in the phone's browser: the **INVITE** address Sector.exe shows, on the same Wi-Fi. The game goes full screen and locks to landscape on the first tap (Android). On iPhone, Safari can't lock the orientation, so the game asks you to turn the phone sideways.

## 2. Installed as an app, from the browser (PWA, works today on HTTPS)

SECTOR is an installable web app: it has a manifest, app icons and a service worker. On a server reached over **HTTPS** (a hosted server):

- **Android (Chrome):** the menu offers **Install app**. It gets a home-screen icon and opens full screen in landscape, like any app.
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**. It opens full screen with its own icon.
- **Computers (Chrome, Edge):** the install button in the address bar.

A LAN server (`http://192.168…:3000`) isn't HTTPS, so browsers won't install it as a full app (you can still add a shortcut). That's why a hosted HTTPS server is worth having: anyone, anywhere, can install SECTOR from it in two taps, with no app store and no review, and it always runs the latest version.

## 3. A real app (Android APK now; App Store and Play Store later)

`mobile/` is a [Capacitor](https://capacitorjs.com) app: a native Android/iOS shell around the game.

- It opens on its own **start screen**: type a server address once (the INVITE address, or a hosted server) and it remembers it, connecting straight away next time. **⇄ SERVER** on the game's front page (and **⇄ CHANGE SERVER** in the pause menu) goes back to it.
- **Landscape only, full screen** (no status bar or navigation bar on Android), and the screen stays awake during long turns.
- Talks to servers on your Wi-Fi over plain http (Android allows cleartext; iOS gets a local-network permission).
- The game itself always comes from the server, so updating the server updates every phone. The app only needs a new build when the start screen or the native settings change.

### Building the Android app

GitHub does it: **Actions → android → Run workflow**. A few minutes later the run's page has **SECTOR-android.apk** under *Artifacts*. Give the run a release tag (like `v0.10.7`) to attach the APK to that release too.

To install it, open the APK on the phone (Android asks you to allow installs from that source the first time).

On your own machine (needs Node 22+, JDK 21 and Android Studio or the Android SDK):

```
cd mobile
npm ci
npm run android          # makes android/: landscape, full screen, icons
cd android && ./gradlew assembleDebug
```

### Publishing

- **Google Play:** a one-off $25 developer account. Make an upload keystore (`keytool -genkey -v -keystore sector.jks -alias sector -keyalg RSA -keysize 2048 -validity 10000`), then add it to the repo's secrets: `ANDROID_KEYSTORE` (the .jks, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. The workflow then also builds a signed **SECTOR-android.aab** to upload to the Play Console.
- **Apple App Store / TestFlight:** needs a Mac with Xcode and an Apple Developer account ($99 a year). On the Mac: `cd mobile && npm ci && npm run ios`, open `ios/App/App.xcworkspace` in Xcode, set the team and bundle ID, and archive. TestFlight is the easy way to get it onto friends' iPhones before a store release.

### Things to decide before the stores

- **The app ID** is `com.sectorgame.app` (in `mobile/capacitor.config.json`). Change it before the first store upload: it can't change afterwards.
- **A hosted server.** Store reviewers (and most players) won't have a PC running Sector.exe. Put a hosted server's address in `DEFAULT_SERVER` in `mobile/www/index.html` and the app works out of the box.
- **Offline play.** Apple rejects apps that are "just a website", and a wrapper that only works with a server nearby is at risk. Singleplayer that runs on the phone itself (the engine and the bots are already plain JavaScript that runs in a browser) would make the app stand on its own: worth doing before an App Store submission.
- **Icons and splash screens** come from `mobile/assets/` (made by `node tools/make-icon.js`), turned into every size by `@capacitor/assets` during the build.
