# Sideline AI

Fantasy football AI assistant (AI chat and lineup optimizer), built with Expo SDK 57 and Expo Router for a hackathon.

## Prerequisites

- Node.js 22 or newer
- npm

## Setup from a clean clone

1. `npm install --legacy-peer-deps`
   The `--legacy-peer-deps` flag is required: a react-dom 19.3 peer dependency wants react `^19.3` while Expo SDK 57 pins react `19.2.3`. A plain `npm install` fails on the peer conflict.
2. `cp .env.example .env`
3. Fill in the keys in `.env` (see below).
4. `npx expo start`

Then scan the QR code with the Expo Go app or press `a` for an Android emulator.

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` and `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY`: RevenueCat public SDK keys (publishable, safe for client). Get them from your RevenueCat dashboard.
- `EXPO_PUBLIC_OPENAI_API_KEY`: OpenAI API key used by the AI chat and lineup optimizer. Supplied at build time, never committed.

## Scripts

- `npm run typecheck`: `tsc --noEmit`
- `npm run lint`: `eslint . --ext .ts,.tsx`
- `npm start` / `npm run android` / `npm run ios` / `npm run web`: run the app

## EAS build and release (Android-first)

We ship on Android only. No App Store submission.

1. `npm install -g eas-cli`
2. `eas init`: links the project to EAS and records the `projectId` in `eas.json`. Already done in this repo; only re-run if starting from a fresh clone that lacks `eas.json`.
3. `eas build --platform android --profile production`: produces a signed AAB for Google Play.
4. Submission: upload the AAB in the Google Play Console web UI to a new app record.

The following are the human's lane (full steps live in SUBMISSION.md): Google Play Console registration ($25 one-time fee), the Play app record setup, IAP products, and the content rating and data safety questionnaires.

### Stretch goal: Samsung Galaxy Store

Seller registration for the Galaxy Store is free, and the same signed AAB/APK produced by the Play build can be submitted there. It is worth a look because the Shipaton "Best App for Galaxy" sponsor award pays $20K for first place and does not require exclusivity. Treat it as a stretch after the Play submission is in review, so it never complicates the Play track.

## Project structure

- `app/`: Expo Router screens and routes
- `components/`: UI components
- `lib/`: shared logic (AI client, billing, fantasy data)
- `assets/`: app icon, splash, adaptive icons, favicon
