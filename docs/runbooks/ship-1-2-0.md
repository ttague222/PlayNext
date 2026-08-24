# Runbook: Ship 1.2.0

> Prepared 2026-08-24. Build on/after **Sep 1** (EAS free-tier quota resets).
> One-time unlocks from 1.1.0 all carry over; the Play service-account API now
> works (verified 2026-08-24 — created and deleted a test edit), so BOTH
> stores submit via `eas submit` this time. No manual .aab upload.

## What ships in 1.2.0

- **"Why not?" + free-tier learning** — thumbs-down on cards opens the reason
  modal; engine permanently excludes rejections server-side and applies
  ±0.10 taste nudges from the user's own signals (all signed-in users)
- **Undo toast** for rejections (restores card, deletes signal)
- **Reason chips** in the Not For Me collection
- **Funnel analytics**: why_not_opened / reason / skipped / already_played /
  undo, plus game_shared from the detail screen
- **Battle.net store chip** (SC2 + WoW linked in catalog)
- **One-tap store links** ("Leave App?" dialog removed)
- **Haptics** (expo-haptics — NEW NATIVE MODULE, see build notes)
- **Share from GameDetail header**; accessibility labels on all icon buttons
- Server side already live: 1,390-game catalog, refreshed subscription tags,
  games cache, free-tier learning engine

## Pre-build checklist

1. **Version convergence (CRITICAL)**: `mobile-app/app.config.js` →
   `version: "1.2.0"`, iOS `buildNumber: "14"`, Android `versionCode: 21`.
   In App Store Connect, create the new version as **1.2.0** — the ASC
   version label MUST equal the binary version this time (converges the
   1.0.6-label / 1.1.0-binary split permanently; see ship-1-1-0.md).
2. **CI flip**: restore `mobile-build.yml` push default from `skip` to `all`
   (quota is reset by then anyway).
3. `cd mobile-app && npx jest && npx expo-doctor` — expect 152/152 and 18/18.

## Build

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app
npx eas-cli build --platform all --profile production
```

- Android signs with the EAS default credential (upload key SHA1 ...6D:FF).
- iOS: ASC API key already stored; expect ~no prompts.

## Device verification (MANDATORY before any submit)

Rule from 1.1.0: the react-lockfile white-screen was ONLY caught by
emulator-testing the production artifact. Repeat that, plus this release has
a new native module (expo-haptics):

1. Install the production .aab (bundletool) or .apk on the Android emulator;
   TestFlight-install the iOS build on a real iPhone if available.
2. Smoke: launch → onboarding → rec flow → results render with art.
3. New-feature pass: thumbs-down a card → reason modal → pick a reason →
   replacement swaps in → undo toast appears → tap UNDO → card restored.
4. Check the Not For Me collection shows the reason chip (after re-rejecting).
5. Store chip opens directly (no Leave App dialog).
6. **Real device only**: haptics fire on accept/reroll (simulators are
   silent — do not chase this on an emulator).
7. Never attach iOS builds 11/12/13 — only the NEW build (14).

## Submit

```bash
npx eas-cli submit --platform all --latest
```

- Android now goes through the API (verified working). If it 403s again,
  fall back to manual .aab upload in Play Console and re-check the
  service-account app permissions.
- iOS: attach build 14 to ASC version 1.2.0, use release notes below,
  Submit for Review.

## Store release notes (both stores)

```
What's new in 1.2.0:

- Not your kind of game? Tell us why. Tap the thumbs-down on any
  recommendation and PlayNxt learns from it - free for everyone.
- Changed your mind? Undo a "not for me" with one tap.
- Your Not For Me list now remembers why you passed on each game.
- Store pages now open in one tap.
- Battle.net links for Blizzard games.
- A little rumble where it counts, plus accessibility improvements
  and 300+ new games added to the catalog - including hundreds of
  hidden gems you have probably never heard of.
```

(Keep Play listing METADATA frozen until the ~Sep 3 ASO read-out — release
notes are fine to update, the store listing copy is not.)

## Post-submit

- Play: expect processing + review ~1-3 days; iOS similar.
- After approval: verify ASC now shows **1.2.0** as the live version label.
- Watch Sentry + the why_not funnel once GA access is granted.
- Bump `docs/ROADMAP.md` Current State.
