# Ship 1.8.0 (Seasonal Themes) — Release checklist

Feature set: seasonal collections on the Play tab, seasonal palettes, analytics for both, Horror chip for every mood.
Spec: `docs/superpowers/specs/2026-10-20-seasonal-themes-design.md` (acceptance criteria in §10, analytics in §7, Horror in §8)
Plan: `docs/superpowers/plans/2026-10-20-seasonal-themes.md`
Branch: `feat/seasonal-themes`. Events reference: `docs/ACTIVATION-TRACKING.md`.

This is the hand-off for the work the branch could not do itself: it needs an EAS
build, an emulator or phone, and the Firebase console. Run it from
`/mobile-release playnxt` for the build and submit steps.

## Timing

- Target: submit both stores by about **2026-10-28** so 1.8.0 is live for the
  **Nov 1** Harvest start. A slip only shortens the proof window; nothing breaks,
  because older builds ignore `/api/seasonal`.
- **1.8.0 can be built in parallel but can only be submitted after 1.7.0 is
  released or rejected.** 1.7.0 is waiting on store-console steps (Android draft
  awaits Start rollout, iOS awaits the ASC version record). Don't submit 1.8.0
  until that is resolved.

## Content approval gate (Tom)

Nothing in the content PR merges until these are approved:

- [ ] Harvest copy (title and blurb) in `docs/growth/2026-10-seasonal-copy-draft.md`. Later seasons' copy can still be edited after release through the API file.
- [ ] The adjusted Harvest palette (accent `#c87941`, decor `#b5652e`) and the adjusted Summer palette. Both failed the color-distance rule as first proposed.
- [ ] `validate_seasonal.py` is clean for every collection (last full run 2026-10-20: PASS, 60 samples).
- [ ] After **any** edit to `api-service/src/content/seasonal.json`, run `cd mobile-app && npm run sync-seasonal` so the bundled fallback matches. A test fails if the two drift.
- [ ] API deployed with the approved content before the app build is cut.

## Build and versions

- [ ] Bump the version (1.8.0), iOS buildNumber and Android versionCode. This is a release step and was not done on the branch.
- [ ] Open the PRs: API, app, and web (Horror chip, from Task 6). Merge, deploy API and web.
- [ ] `cd mobile-app && eas build --platform all --profile production`
- [ ] Store What's New copy in `store/app-store/` and `store/google-play/` (`whats-new-1.8.0.txt`), matching the in-app entry in `mobile-app/src/config/changelog.js`. No em dashes.

## Device pass

Use the emulator recipe from the earlier releases (`docs/runbooks/ship-1-3-0.md`, `docs/superpowers/plans/2026-09-28-tonights-picks.md` for changing the device date). Install the production-profile or preview build.

**Test dates**

- Default palette: any date before 2026-11-01 (the calendar starts with Harvest on Nov 1, so the real date before launch shows no season). After launch the calendar runs without gaps through 2027-10-31, so the default palette needs a date before Nov 1 2026.
- Harvest: set the device date to **2026-11-05**.

**Screens to screenshot, once under default and once under Harvest**

- [ ] Play (with the Seasonal card under Harvest)
- [ ] Time select
- [ ] Mood select
- [ ] Optional filters
- [ ] Results
- [ ] GameCard detail
- [ ] Share card

**Checks**

- [ ] Default screenshots match the pre-change ones except the two spec §6.4 fixes (dark text on small pink pills, the lighter gray on Results).
- [ ] Under Harvest, brand pink stays on every tappable element (buttons, selected chips, match %). The season accent only shows on non-interactive highlights. Mood and status colors are unchanged.
- [ ] Mood select takes only the seasonal background and decor, no season accent.
- [ ] The share card stays pink and is identical under Harvest and default (spec §2: shares never take the seasonal palette).
- [ ] Tapping the Harvest card shows the same three picks as the card thumbnails, and they are real recommend output.
- [ ] A date outside the calendar (before 2026-11-01 or after 2027-10-31) shows neither card nor palette. Also spot-check one date in each other season (Dec 15, Feb 14 for the Valentine's collection, Apr 1, Jul 1, Oct 1) for the right card and palette.

## Offline check

- [ ] Clear app storage, switch the device to airplane mode, launch with the date set to 2026-11-05. The Harvest card and palette still appear (bundled fallback).
- [ ] Back online, relaunch: the card and palette are still correct (live content replaces the fallback).

## Horror spot-check (spec §8)

- [ ] In the app, Horror plus each of the four moods (wind down, casual, focused, intense), **3 runs each**: every pick is horror-tagged and no fallback message appears.
- [ ] The same on the web (the web side ships first).

## Analytics: DebugView

1. `adb shell setprop debug.firebase.analytics.app com.playnxt.app`
2. Open Firebase console > DebugView, and set the device date to 2026-11-05.
3. Open the Play tab, tap the Harvest card, accept a pick ("I'll play this!"), go back and reroll once.

Confirm each event, with `collection_id = harvest-2026-long-weekend`:

- [ ] `seasonal_collection_viewed`: `collection_id`, `season_id = harvest-2026`. Fires once per collection per local day, so a second visit the same day should **not** fire it again.
- [ ] `seasonal_collection_tapped`: `collection_id`, `season_id = harvest-2026`
- [ ] `recommendation_started`: `pick_source = seasonal`, `collection_id`, plus `minutes = 60`, `mood = casual`
- [ ] `recommendation_viewed`: `pick_source = seasonal`, `collection_id`, `result_count`. No `latency_ms` on the collection tap.
- [ ] `rec_requested` (fires on the reroll only, not on the collection tap): `pick_source = seasonal`, `collection_id`, `is_reroll = true`
- [ ] `recommendation_viewed` after the reroll: still carries `collection_id`
- [ ] `game_selected`: `pick_source = seasonal`, `collection_id`, `game_id`, `rank`
- [ ] `rec_accepted`: `pick_source = seasonal`, `collection_id`
- [ ] A normal flow session (time, then mood) fires `recommendation_started` with `pick_source = flow` and **no** `collection_id`.

## Firebase console (Tom)

- [ ] Register `collection_id` and `season_id` as **event-scoped custom dimensions** (Admin > Custom definitions). Display names can't contain parentheses, so use plain names like `Collection ID` and `Season ID`. Do this before the release ships; registration isn't retroactive.

## Submit

- [ ] 1.7.0 is released or rejected (see Timing).
- [ ] `eas submit --platform all --profile production`
- [ ] ASC: create the **1.8.0** version record, select the build, paste the What's New text, submit for review.
- [ ] Play Console: confirm the release is processing, paste the What's New text, start rollout.

## Post-release

- [ ] Tag: `git tag v1.8.0 && git push --tags`
- [ ] Nov 1: confirm the Harvest card shows on a real device with the live API, and the palette applies.
- [ ] Watch `seasonal_collection_viewed` vs `seasonal_collection_tapped`, and `game_selected` with `pick_source = seasonal`.
- [ ] Crash-free rate in the first 24h.
- [ ] Late November: confirm the Winter Holidays season rolls in on Dec 1 (content is already in the API file and the bundle).
