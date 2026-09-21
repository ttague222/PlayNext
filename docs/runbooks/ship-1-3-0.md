# Runbook: Ship 1.3.0

> Prepared 2026-09-21. The Steam sync + Backlog Mode + share cards release
> (PR #2). Price stays **$1.99** (Tom's call 2026-09-21 — the $2.99 move
> from the spec is deferred; store copy and the paywall are price-agnostic,
> so nothing changes if/when it happens later).

## ⚠️ HARD GATE: Steam Web API key

Do NOT submit this release until the production API can talk to Steam —
otherwise the new Connect Steam screen shows "Steam sync is not configured
on this server" to real users on day one.

1. Get a key at https://steamcommunity.com/dev/apikey (any domain value,
   e.g. `playnxt.app`). *2026-09-21: page was rate-limiting ("too many
   requests") — it clears within ~a day, retry.*
2. `echo -n "<key>" | gcloud secrets create STEAM_WEB_API_KEY --data-file=-`
   in project `playnxt-1a2c6`, and grant the Cloud Run runtime service
   account **Secret Manager Secret Accessor** on it.
3. Flip the `--set-secrets` line in `.github/workflows/api-deploy.yml` to
   `"CRON_SECRET=CRON_SECRET:latest,STEAM_WEB_API_KEY=STEAM_WEB_API_KEY:latest"`
   (the comment above that line has the same instructions), push, let the
   deploy run.
4. Verify from anywhere (401 means auth is working and the endpoint is
   live; 503 means the key didn't land):
   `curl -i https://playnxt-api-167253232570.us-central1.run.app/api/library/steam`
   → expect **401**, not 503.

## What ships in 1.3.0

- **Steam Library Sync (free)** — Settings → Game Library → paste profile
  URL; played games (2h+) excluded from picks; "In your library" chip on
  owned-but-unplayed picks; re-sync (1h cooldown) and full-delete disconnect
- **Backlog Mode (premium)** — "Anything / My backlog" toggle on time
  select; picks from the user's own unplayed Steam games with a
  library_fit explanation line; falls back to catalog with a banner when
  nothing in the backlog fits; free users get a lock → paywall, premium
  users without a sync route to Connect Steam
- **Share cards** — branded 1080×1350 image in the native share sheet from
  the game-detail share button and the celebration modal; campaign-tagged
  store links (`utm_source=share_card`)
- **Premium screen** now leads with Backlog Mode
- Better API error surfacing (detail messages instead of axios generic)
- New funnel analytics: steam_sync_* / backlog_mode_* / share_*
- Server side (live on merge, independent of the binary): /library/steam
  endpoints, engine exclusion + `library_only` path

New native modules this build: **react-native-view-shot, expo-sharing**
(pinned to SDK 54 bundled versions). Like expo-haptics in 1.2.0, these make
emulator verification of the production artifact mandatory.

## Pre-build checklist

1. **Merge PR #2** and confirm the API deploy went green.
2. **Steam key gate above is DONE** (curl check passes).
3. **Version convergence (CRITICAL, same rule as 1.2.0)**:
   `mobile-app/app.config.js` is already bumped on the branch —
   `version: "1.3.0"`, iOS `buildNumber: "15"`, Android `versionCode: 22`.
   In App Store Connect create the new version as **1.3.0** — ASC label
   MUST equal the binary version.
4. `cd mobile-app && npx jest && npx expo-doctor` — expect **176/176** and
   **18/18** (a 16/18 run inside the Claude sandbox was its two
   network-dependent checks being blocked; locally it must be 18/18).
5. Optional but smart: with `STEAM_WEB_API_KEY` in `api-service/.env`, run
   the API locally and do the full Steam flow in Expo Go before spending
   EAS quota.

## Build

```bash
cd C:/Users/ttagu/Projects/PlayNxt/mobile-app
npx eas-cli build --platform all --profile production
```

Same credentials setup as 1.2.0 (EAS default Android key, stored ASC API
key).

Build from the local machine, not the GitHub Actions dispatch: the CI
runner has no `GoogleService-Info.plist` / `google-services.json`
(gitignored), and eas-cli needs them locally to resolve iOS entitlements
before upload (run 35618290416 failed exactly there, 2026-09-21). The
workflow now materializes them from `GOOGLE_SERVICE_INFO_PLIST_B64` /
`GOOGLE_SERVICES_JSON_B64` repo secrets — once those are added, CI
dispatch works too.

## Device verification (MANDATORY before any submit)

Emulator/production-artifact rule from 1.1.0 still applies, plus the two
new native modules. Full pass:

1. Smoke: launch → rec flow → results render with art.
2. **Steam sync (free)**: Settings → Game Library → Steam Library Sync →
   paste a real profile URL → match counts render. Then get recommendations
   and confirm a game with 2h+ playtime does NOT appear. Re-sync
   immediately → friendly cooldown message. Private-profile error copy:
   test with a private profile if available.
3. **In your library chip** shows on an owned-but-unplayed pick.
4. **Backlog Mode gates**: free account → toggle shows lock → tap opens
   paywall (now leading with Backlog Mode). Premium, no sync → routes to
   Connect Steam. Premium + synced → mode on, green hint, picks show the
   "sitting unplayed in your Steam library" line. Pick a time/mood combo
   your backlog can't satisfy → fallback banner + catalog picks.
5. **Share cards (both new modules exercise here)**: accept a pick →
   celebration modal → "Share this pick" → share sheet shows the branded
   card with time/mood chips; send to a real chat and eyeball it. Repeat
   from the game-detail header share (no chips there — expected). On
   Android confirm the image-only share; on iOS confirm image + text with
   store links.
6. Disconnect Steam → confirm picks can include played games again.
7. iOS: only attach the NEW build (15).

## Submit

```bash
npx eas-cli submit --platform all --latest
```

- Android via the Play API (verified working since 1.2.0).
- iOS: attach build 15 to ASC version **1.3.0**, release notes below.

## Store copy (paste at submission, not before)

- ASC What's New → `store/app-store/whats-new-1.3.0.txt`
- ASC Description → `store/app-store/description.txt` (adds the
  Library-aware bullet + Premium/Backlog Mode section)
- Play release notes → `store/google-play/whats-new-1.3.0.txt`
- Play listing metadata: the ASO §6 title/short-description changes are a
  SEPARATE decision (control period ended ~Sep 3, unreviewed) — do not
  bundle them into this release without reading the Apple metrics first.

## Post-submit

- Verify ASC shows **1.3.0** as the live version label after approval.
- Watch Sentry + the new funnels: steam_sync_started/completed/failed,
  backlog_mode_selected / locked_tap / needs_sync, share_opened/completed,
  and Play installs with `utm_source=share_card`.
- `backlog_mode_locked_tap` is the conversion signal for the deferred
  $2.99 decision — revisit price once there's data.
- Known papercut carried from 1.2.0: Cloud Run cold start (~17s) exceeds
  the client timeout on first use of the day — min-instances=1 still the
  cheapest fix, still open.
- Bump `docs/ROADMAP.md` Current State.
