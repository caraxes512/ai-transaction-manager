# AI Transaction Manager: mobile app

Expo (React Native) + TypeScript + Expo Router. Talks to the same FastAPI backend as the web dashboard.

## Run it

```bash
# 1. backend, reachable from your phone:  uvicorn app.main:app --host 0.0.0.0 --reload
# 2. this app
cd mobile
cp .env.example .env      # set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start            # scan the QR code with Expo Go, or press a / i / w
```

`EXPO_PUBLIC_API_URL` must be reachable **from the phone**, not `localhost` on a real device:

| Where it runs | URL |
|---|---|
| iOS simulator | `http://localhost:8000` |
| Android emulator | `http://10.0.2.2:8000` |
| Real phone on your Wi-Fi | `http://<your computer's LAN IP>:8000` |

Android blocks plain `http://` in *release* builds. That's fine for development; a real deployment needs HTTPS.

## What's in it

| Screen | What it does |
|---|---|
| **Login / register** | JWT kept in the OS keychain/keystore (`expo-secure-store`); any 401 logs you out |
| **Home** | Month switcher, income/spent/net, spending by category, 6-month trend, budgets needing attention, unusual activity, log out |
| **＋ Add** | Quick add with the **live AI category preview** while you type |
| **📷 Scan receipt** | Photo or library image -> a **draft** (shop, total, date, suggested category, warnings) -> *Add transaction* / *Edit first*. Nothing is saved until you confirm |
| **Transactions** | Infinite scroll, filter by type, tap the category chip to change it, delete with confirmation |
| **Budgets** | Progress bars, edit/delete, add new; "at your usual pace you'll exceed it" only when that's actually true |
| **Insights** | Summary, findings and tips, anomalies, and a "show the numbers behind this" panel |

## Receipt scanning

`POST /ai/receipt` (see the backend) needs `ANTHROPIC_API_KEY` on the server; without it the screen shows a clear
"isn't set up" message. The model only reads text off the photo. The server validates everything it returns (total must
parse as a positive amount, a missing or future date falls back to today and is flagged, non-INR currency is warned about),
and nothing is saved until the user confirms the draft. Photos are taken at quality 0.6 to stay under the server's 5 MB limit.

## Shared code

The API client, response types and formatters are **copied from `web/src`**, which is the source of truth:

```bash
npm run sync-shared      # after changing web/src/api/* or web/src/lib/format.ts
```

A test fails if the copies drift, so the two apps can't silently disagree about the API.

## Scripts

```bash
npm test             # 34 tests (jest-expo + Testing Library): login, add, receipt flow, auth, components, drift check
npm run typecheck
npx expo export --platform web    # builds the whole app with Metro (also a good smoke test)
```

## Android APK

See **[BUILD_APK.md](BUILD_APK.md)**: EAS cloud build or local Gradle build, how to point the app at your backend, and installing it.

## Pinned versions

`react`, `react-dom` and `react-native` are pinned to the exact versions Expo SDK 57 requires. Loose ranges let npm install
`react@19.3` beside `react-dom@19.2`, which crashes the app at startup (React error #527). npm may warn that the test
renderer's `react-reconciler` wants React 19.3; that is test-only and harmless.

## Not done yet (deliberately)

Biometric app lock, push notifications for budget alerts, offline entry with sync, and image resizing before upload.
None of those can be verified without a device or simulator, so they're not shipped half-tested.
