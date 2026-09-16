# SUBMISSION.md: Sideline AI, RevenueCat Shipaton 2026

Sideline AI is a fantasy football AI co-pilot for Android. Connect a Sleeper
account and get an AI assistant that knows your teams: weekly matchup
dashboard, AI lineup optimizer with start/sit reasoning, trending waiver adds
filtered to your leagues, and a chat co-pilot with your league context
injected into every prompt.

## Shipaton requirement mapping

| Requirement | Status |
|---|---|
| Brand-new app, first released Aug 1 to Sep 30, 2026 | Code complete. Store release is in WES LANE below. |
| Built for Android (Google Play; Galaxy Store stretch) | Yes. Bundle id `com.practicalsystems.sideline`. |
| RevenueCat SDK powering at least one in-app purchase | Implemented: `react-native-purchases` 10.8.1, entitlement id `pro`, Monthly ($4.99/mo) and Season ($29.99/season) packages, paywall + restore + `ProGate` gating. Live purchase needs keys and products (WES LANE). |
| Text description of features | Draft below, ready to paste into Devpost. |
| Demo video, max 2 min, app running on the device it was built for | WES LANE: record on Android, upload to YouTube or Vimeo. |
| Published store URL | WES LANE: Google Play listing. |
| 1024x1024 app icon | Done: `assets/icon.png` (verified 1024x1024 PNG). |
| Screenshots | WES LANE: capture from the Android build. |

## Monetization (HAMM-relevant)

Free tier: full dashboard, waiver wire, 3 AI chats per week. Pro
($4.99/month or $29.99/season) unlocks unlimited AI chat and the AI lineup
optimizer. The paywall is served by RevenueCat offerings; the season pass is
matched by package identifier containing "season" (configure it as a one-time
in-app product in Play Console, attached to the `pro` entitlement).

## WES LANE (everything needing the human)

Do these in order. Nothing here can be done by the agent.

1. **Google Play Console**: pay the $25 one-time registration, create the app
   record for package `com.practicalsystems.sideline`.
2. **RevenueCat**: create the account and project, add the Google Play app,
   create two products in Play Console (a $4.99/mo subscription and a
   $29.99 one-time "season" in-app product), attach both to the `pro`
   entitlement, add both to an offering and mark it current.
3. **EAS**: `npm install -g eas-cli`, `eas login`, then `eas init` in the
   project (this links the project and writes the projectId into eas.json).
4. **Build env**: set `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` and
   `EXPO_PUBLIC_OPENAI_API_KEY` for the production build (EAS secrets or
   `eas env`; these are baked in at build time, never committed).
5. **Build**: `eas build --platform android --profile production`. Download
   the AAB and upload it to the Play Console internal test track first.
6. **Play questionnaires**: content rating and data safety. Notes for the
   forms: the app has no accounts of its own; it sends the user's Sleeper
   username to api.sleeper.app, chat text to api.openai.com, and purchases
   through Google Play Billing via RevenueCat. No ads SDKs.
7. **Ship the release** to production on Play within the Aug 1 to Sep 30,
   2026 window.
8. **Demo video**: record the app running on Android, max 2 minutes, upload
   to YouTube or Vimeo (public or unlisted).
9. **Screenshots + store listing**: capture from the release build, write the
   listing (the draft description below is a starting point).
10. **Submit** on Devpost before September 30, 2026.

### Stretch: Samsung Galaxy Store (do not let this risk the Play submission)

Seller registration is free. Submit the same signed AAB/APK to the Galaxy
Store after Play is live. This makes the app eligible for the Shipaton
"Best App for Galaxy" sponsor award ($20,000 for 1st place; Galaxy Store
exclusivity is not required).

## Devpost description draft (paste-ready)

Sideline AI is your fantasy football co-pilot. Sign in with your Sleeper
username and it pulls in all your leagues: live scores and weekly matchups on
the dashboard, trending waiver adds filtered to players who are actually
available in your leagues, and an AI chat that knows your rosters, so you can
ask "who should I start at flex this week?" and get an answer grounded in
your teams. Go Pro for unlimited AI chat and the weekly AI lineup optimizer,
which gives you start/sit calls with plain-English reasoning for every roster
slot.

## Verification evidence (agent-run)

- `npx tsc --noEmit`: exit 0, zero errors.
- `npx eslint .`: exit 0, zero errors, zero warnings. (Note: stock
  eslint-config-expo pulls eslint 10, whose bundled eslint-plugin-react
  crashes on load. Pinned `eslint@9` as a devDependency; if you reinstall
  fresh, use `npm install --legacy-peer-deps` because react-dom 19.3's peer
  range conflicts with Expo 57's react 19.2.3.)
- `npx expo-doctor`: 21/21 checks pass. (One fix applied along the way: the
  top-level `splash` key is rejected by the SDK 57 config schema; splash is
  now configured through the `expo-splash-screen` plugin entry.)
- `npx expo prebuild --platform android` (in a temp copy, since removed):
  exit 0, generates `namespace 'com.practicalsystems.sideline'` with
  MainActivity/MainApplication under the matching package path.

Not verified (needs WES LANE): the EAS cloud build itself, the end-to-end
RevenueCat purchase flow against real products, and Play review.

## Deferred

- Push alerts (game-day / waiver alerts via OneSignal): sequenced after the
  first green build per the research plan. Not in v1; the paywall does not
  promise them.
- iOS: config remains in app.json but $0 is being spent on Apple Developer,
  so there is no App Store target. The RevenueCat provider still selects the
  Apple key on iOS if a build is ever made.
