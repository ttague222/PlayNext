# Ship 1.4.0 — Runbook

Feature set: changelog modal, Coming Soon + ratings, fall catalog, candidate pipeline.
Spec: `docs/superpowers/specs/2026-09-22-q4-engagement-and-catalog-design.md`

## Already done (2026-09-23)

- [x] Merged to main (5af603c), API deployed green, `/games/upcoming` + rating endpoints live-verified
- [x] Fall batch seeded (15 titles), `migrate_field_names.py` run, `created_at` stamped, store links backfilled where RAWG had them
- [x] Versions: 1.4.0 / iOS buildNumber 16 / Android versionCode 23
- [x] Store copy: `store/app-store/whats-new-1.4.0.txt`, `store/google-play/whats-new-1.4.0.txt` (Play copy includes the 1.3.0 catch-up line — 1.3.0 Play notes were never pasted and can't be edited post-rollout)
- [x] `RAWG_API_KEY` repo secret + "Allow GitHub Actions to create and approve PRs" setting; pipeline verified live (PR #10)
- [x] Emulator validation passed (preview APK): fresh-install guard, pick flow, signal loop, rating toggle + server persistence, cold-start % guard
- [x] Settings footer version fix (was hardcoded v1.0.0)

## Build

- [ ] `cd mobile-app && eas build --platform all --profile production` (queue was slow 2026-09-23 afternoon; build from commit 2316571 or later)
- [ ] Both platforms finish green on expo.dev

## Device pass (Tom, real phone with 1.3.0 installed)

Installing 1.4.0 over 1.3.0 is itself the test of the upgrade path:

- [ ] Changelog modal appears on first launch (pre-tracking upgrader path) with 3 features + CTAs
- [ ] "See What's New" CTA lands on What's New: 5 recent games + Coming Soon section (10 titles, dates)
- [ ] Tap a Coming Soon title (e.g. GTA VI): detail loads, NO "Played it?" rating row
- [ ] Tap a recent/released game: rating row present; thumb up sticks; kill + relaunch → still set
- [ ] Steam sync still connected; picks still exclude played library
- [ ] Core flow: time → mood → 3 picks, no crash, ads behave

## Submit

- [ ] `eas submit --platform all --profile production`
- [ ] ASC: create the version record labeled **1.4.0** (the live listing shows 1.0.7 — the label track never converged at 1.2.0; converge it now), select build 16, paste `store/app-store/whats-new-1.4.0.txt`, submit for review
- [ ] Play Console: confirm the production release is processing, paste `store/google-play/whats-new-1.4.0.txt`

## Post-release

- [ ] Tag: `git tag v1.4.0 && git push --tags`
- [ ] Watch first digest after release (Saturday): "5 new games this week... Plus 10 more coming soon"
- [ ] Watch analytics: `changelog_shown/cta_tapped` (does the modal drive `backlog_mode_locked_tap`?), `game_rated`
- [ ] Curate or close candidate PR #10 (next auto-run Oct 5)
- [ ] Crash-free rate in the first 24h

## Notes

- Announced-only digest pushes fire only days 1–7 of a month; if 1.4.0 is not live by Sat Oct 3, 1.3.0 users may get a "coming soon" push landing on an empty What's New. Ship before then.
- Deferred tech debt (candidates for 1.4.1+): App.js modal orchestration refactor (3 modal lifecycles inline), shared GameRow for WhatsNew rows, rating vocabulary defined in 3 places, `get_positive_signals` excludes `rated_up` (Smart History = recommendation outcomes only, deliberate), date-format locale convention (device locale vs en-US), web-admin can't edit `release_date`, pre-existing `test_old_sync_passes_cooldown` failure on main (fix in flight on `android-r8-release-builds`).
