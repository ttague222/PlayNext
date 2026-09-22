# Q4 Engagement & Catalog Design — 1.4.0 Feature Set

**Date:** 2026-09-22
**Status:** Approved (brainstorm session with Tom)

## Overview

Four features validated and scoped in a product brainstorm. All user-facing pieces ship together in a single **1.4.0** release; the catalog automation pipeline ships independently on its own track (CI/backend only, no binary dependency).

Ideas raised and where they landed:

| Idea | Decision |
|---|---|
| Add more games, especially new releases | **Yes** — curated fall batch now, plus an automated monthly candidate pipeline |
| Tell existing users what's new after updates | **Yes** — post-update changelog modal announcing app features (not catalog additions) |
| Upcoming/popular games to bring users back | **Scoped down** — push-first re-engagement + small Coming Soon section on the existing WhatsNewScreen. No new browse surface (conflicts with the 3-picks mission and ASO positioning, ASO-PLAN §2) |
| User-submitted reviews | **Scoped down** — lightweight thumbs ratings, no free text. Full written reviews rejected for now: cold-start emptiness, Apple UGC moderation requirements, and overlap with the existing signals system |

## Feature 1: Fall 2026 catalog batch + monthly release pipeline

### Curated batch (ships with 1.4.0 window, data-only)

- New file `api-service/scripts/games_data/refresh_2026_fall.json`: September 2026 releases plus announced fall-window titles.
- Seeded via the existing `seed_refresh.py` (title+id dedupe gate, tombstones in `deleted_game_ids.json` honored).
- **Must include announced-but-unreleased titles with a future `release_date`** — these populate the Coming Soon section (Feature 3).
- Full curation per game as usual: `time_tags`, `energy_level`, `mood_tags`, `stop_friendliness`, `play_style`, `time_to_fun` are hand-authored; these fields are the product differentiator and are never auto-derived.

### Monthly candidate pipeline (independent track)

- New script `api-service/scripts/new_release_candidates.py`:
  - Queries RAWG for releases in the past ~45 days and announced titles in the next ~60 days, above a popularity floor (tune against RAWG `added`/ratings count so the list stays reviewable, roughly 10–25 candidates/month).
  - Filters out games already in Firestore (same dedupe logic as `seed_refresh.py`) and tombstoned ids.
  - Emits a candidate JSON with RAWG-derivable fields prefilled: `game_id`, `title`, `platforms`, `release_year`, `release_date`, `genre_tags`, `store_links`, `description_short`.
  - Curation fields are emitted empty/placeholder so the seed gate refuses them until a human fills them in.
- New workflow `.github/workflows/new-release-candidates.yml`, modeled on `subscription-refresh.yml`: monthly cron, runs the script, **opens a PR** with the candidate file. Tom reviews, fills in curation fields, merges; merge triggers the seed (same pattern as the subscription refresh's fail-safe design).
- Human-in-the-loop is a hard requirement: the pipeline finds and prefills, it never writes to Firestore on its own.

## Feature 2: Post-update changelog modal

- On app launch: read `lastSeenVersion` from AsyncStorage, compare to the running app version (`Constants.expoConfig.version`).
  - No stored value (fresh install): record current version, show nothing.
  - Stored value differs and a changelog entry exists for the current version: show the modal once, then record.
- Content is an in-app constant (e.g. `mobile-app/src/config/changelog.js`), one entry per release: title, 2–3 feature bullets with icons, optional CTA per bullet as a deep link. No backend, no remote config (YAGNI).
- 1.4.0 content announces both the 1.3.0 features (Steam sync, Backlog Mode, share cards — invisible to users who skipped that update's store copy) and 1.4.0's (Coming Soon, ratings). CTAs: "Connect Steam" → library sync flow; "Try Backlog Mode" → premium screen (`backlog_mode_locked_tap` funnel).
- Analytics events: `changelog_shown`, `changelog_cta_tapped` (with feature key), `changelog_dismissed`.
- Screen/JSX conventions per CLAUDE.md; modal is a reusable component under `components/`.

## Feature 3: Coming Soon + monthly re-engagement push

### Data & API

- `release_date` (ISO date) added to the game model where known; existing docs without it are unaffected (fall back to `release_year` behavior).
- **Recommendation exclusion rule (critical):** games with `release_date` in the future are excluded from the recommendation pool. The engine must never recommend a game the user cannot play tonight. Implemented in `recommendation_service.py` alongside the existing exclusion logic (Not For Me, played-library); covered by unit tests including the day-of-release boundary.
- API: extend the recent-games endpoint or add `/games/upcoming` (thin route in `routes_games.py`, logic in the games service, explicit `response_model`) returning released=false titles ordered by `release_date`.

### UI

- WhatsNewScreen gains a small **Coming Soon** section below the recent additions list: title, platforms, release date. No new screen, no new tab, no browse surface.
- Section hides itself when the upcoming list is empty.

### Push

- Monthly re-engagement notification on the existing Cloud Scheduler + digest infrastructure: "N new games added, M coming in <month>", deep-linking to WhatsNewScreen (already a deep-link target).
- Respects the existing push opt-in; no new permission prompts.

## Feature 4: Lightweight ratings (no free text)

- Thumbs up/down affordance on GameDetail for games the user has played ("Played it?").
- **Reuses the signals system**: writes new signal types `rated_up` / `rated_down` to the existing signals collection (not overloading `worked` / `not_good_fit`, which specifically mean "this recommendation outcome" — a GameDetail rating is broader). The engine's free-tier taste-nudge logic treats `rated_up`/`rated_down` the same way it treats `worked`/`not_good_fit`. One rating per user per game; tapping again toggles/updates.
- Server keeps per-game aggregate counts (incremented on signal write, or recomputed batch-side).
- **Display threshold:** aggregate sentiment ("92% liked this") renders only at ≥10 ratings. Below threshold the user sees only their own rating state. This is the cold-start protection: nobody ever sees "1 person liked this".
- No text input → no moderation surface, no Apple UGC compliance burden.
- This is the data foundation for Phase 4 social proof (ROADMAP Phase 4: anonymous aggregate stats), not a detour from it.

## Ship plan

1. **1.4.0 (one release, one store review pass):** changelog modal, Coming Soon section + exclusion rule, ratings, fall catalog batch seeded.
2. **Independent, no binary:** monthly candidate pipeline. Must not gate the release.
3. Monthly push turns on once 1.4.0 is live (deep-link target must exist in the wild first).

Rough sizing: modal ~0.5 day, Coming Soon + exclusion ~1–2 days, ratings ~1 day, batch is data work. About a week total.

## Testing

- **Backend (pytest):** upcoming-exclusion rule (future date excluded, past/today included, missing `release_date` included), `/games/upcoming` endpoint, rating signal write + aggregate count, threshold logic.
- **Mobile (jest):** version-compare logic (fresh install, same version, upgrade, entry-missing cases), changelog CTA deep links, Coming Soon section render/hide, rating toggle state.
- Seed scripts keep dry-run defaults per catalog-maintenance convention.

## Out of scope (explicitly rejected or deferred)

- Full written reviews with moderation tooling — deferred until the install base can populate them; revisit with Phase 4.
- A browsable "popular games" surface — conflicts with the decision-reduction mission; popularity data would be RAWG's, not ours.
- Remote-config changelog content — in-app constant is enough at this scale.
- Auto-derived curation fields — never; human curation is the product.
