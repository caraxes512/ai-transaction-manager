# Building the Android APK

> **Status:** the APK itself was **not** built by me. The environment I worked in has no Android SDK and no access to
> Google's, Gradle's or Expo's build servers. What I *did* verify is the build configuration: I ran `expo prebuild`
> (which generates the real Android project and needs no SDK) and checked the manifest, package name, icons and permissions.
> So the first real build is yours; the steps below are the shortest path.

## 1. Decide where the backend lives (do this first)

The APK has the API address **baked in at build time** (`EXPO_PUBLIC_API_URL`). A phone can't reach `localhost`.

| Situation | `EXPO_PUBLIC_API_URL` | `ALLOW_CLEARTEXT` |
|---|---|---|
| Demo on your home Wi-Fi | `http://<your computer's LAN IP>:8000` (e.g. `http://192.168.1.50:8000`) | `1` (Android blocks plain http otherwise) |
| Backend deployed somewhere with HTTPS | `https://your-api.example.com` | leave unset |

For the Wi-Fi case, run the backend with `uvicorn app.main:app --host 0.0.0.0`, keep PostgreSQL up, make sure your firewall
allows port 8000, and keep the phone on the same network. For a portfolio you can show anywhere, deploy the backend (HTTPS).

## 2a. Easiest: EAS cloud build (free Expo account)

```bash
cd mobile
npm install
npx eas-cli login                                   # create a free account at expo.dev first
# edit eas.json -> build.preview.env.EXPO_PUBLIC_API_URL  (and delete ALLOW_CLEARTEXT if you use https)
npx eas-cli build --platform android --profile preview
```

The first run asks to create an EAS project (say yes) and to let EAS manage the signing key (say yes). When it finishes
(roughly 10 to 20 minutes) it prints a link and QR code to download the `.apk`.

## 2b. Build it on your own machine

You need **JDK 17 or newer** and the **Android SDK** (easiest via Android Studio; set `ANDROID_HOME`).

```bash
cd mobile
npm install
ALLOW_CLEARTEXT=1 EXPO_PUBLIC_API_URL=http://192.168.1.50:8000 npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease              # on Windows: gradlew.bat assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk
```

The JavaScript is bundled into the APK, so no dev server is needed after installing. The release build is signed with the
template's debug key: fine for installing on your own phone, not for the Play Store.

## 3. Install on the phone

1. Copy or download the `.apk` to the phone and open it.
2. Android will ask you to allow installing from that source ("Install unknown apps"). Allow it for the app you opened it with.
3. Google Play Protect may warn about an unrecognised app. Choose *More details* then *Install anyway* (it is your own build).

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| "Network request failed" or login hangs | Wrong `EXPO_PUBLIC_API_URL` baked into this build; backend not on `--host 0.0.0.0`; firewall; phone on another network; an `http://` URL built without `ALLOW_CLEARTEXT=1`. Rebuild after fixing: the URL can't be changed on an installed APK. |
| Login works but nothing loads | The backend can't reach PostgreSQL, or it was restarted with an empty database |
| "App not installed" | An older build signed with a different key is installed: uninstall it first |
| Receipt scan says "isn't set up" | The *server* has no `ANTHROPIC_API_KEY` |
| Camera permission refused | Settings -> Apps -> AI Transaction Manager -> Permissions -> Camera |

## What the build configuration contains (verified with `expo prebuild`)

- Package `com.example.aitransactionmanager`, version `0.1.0`, `versionCode 1`. **Change the package name** (and raise
  `versionCode` for every new release) before publishing anywhere.
- Rupee icon with an Android adaptive-icon foreground.
- Permissions: internet, camera and photo access (declared by the image-picker library). Microphone is **off** (the plugin
  adds it by default) and the developer-menu overlay permission is **removed**.
- Cleartext http only when `ALLOW_CLEARTEXT=1`; an https build keeps Android's secure default.

## Not verified

Everything about running on real hardware: install, camera, permission dialogs, the keychain, how it looks on your phone's
screen. The same code was exercised in a browser at phone size (see `README.md`), but that isn't a phone.
