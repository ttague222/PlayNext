# Premium Rebuild (v1) — Design

**Date:** 2026-05-31
**Status:** Approved (pending implementation plan)
**Repo:** `ttague222/PlayNext` — `mobile-app/` (React Native + Expo) + `api-service/` (FastAPI on Cloud Run, Firestore)

## Problem / Goal

Today Premium unlocks exactly one thing: `adFree: true` (`PremiumContext.js`). Ads are gated *behind* exhausting 3 free rerolls/day, so most users never feel the pain — and therefore have no reason to pay to remove it ($4 in 6 months bears this out). The paid tier removes a rarely-felt negative instead of adding a wanted positive. `docs/MONETIZATION.md` already designed the right tier (Smart History, Advanced Filters, Sync) but it was never built.

**Goal:** Make Premium something users *want* to buy. Core recommendations stay 100% free (PRD principle #6). Premium becomes: **Smart History + Advanced Filters + (reframed) ad-free unlimited rerolls**, with cross-device sync coming free via login. Free-tier rewarded ads stay unchanged; only the premium *messaging* shifts from ad-removal to value.

## Decisions (locked)
- **Built features:** Smart History + Advanced Filters. Cross-device sync is a listed benefit that works via existing login/server sync (not net-new work).
- **Ads:** unchanged mechanic for free users (rewarded-ad reroll past the daily cap). Premium is no longer *sold* as "remove ads."
- **Pricing:** one-time "lifetime" purchase as the hero (trust-building, per the doc), monthly/annual shown as secondary. No change to the RevenueCat plumbing.
- **Smart History depth:** view + reuse **plus** a heuristic "lean on what's worked" recommendation boost (not ML).

## Approach

Premium is already fully wired via RevenueCat (lifetime + monthly + yearly packages, purchase/restore/manage, `premium` entitlement, `hasFeature()` gate). So this is **almost entirely additive feature work + UI gating + copy**, not payments plumbing. Smart History and Advanced Filters both run on data that already exists (`user_signals` and game metadata), so no Firestore schema changes are required.

## Components

### A. Feature gating — `mobile-app/src/context/PremiumContext.js`
Extend `PREMIUM_FEATURES` from `{ adFree: true }` to:
```js
const PREMIUM_FEATURES = { adFree: true, smartHistory: true, advancedFilters: true };
```
All gating uses the existing `hasFeature('smartHistory' | 'advancedFilters')`. No purchase-flow changes.

### B. Smart History (premium; requires login)
Surfaces what has worked for the user and reuses it.

- **Screen** — extend the existing Library/`HistoryScreen.js` with a "What's worked for you" section: games with `worked`, `played_loved`, or `accepted` signals, each showing the **context** it worked in (derived from the signal's `context.time_selected` / `context.mood_selected`), e.g. *"Worked for a 30-min wind-down."* Reuses the existing `GameCard`.
- **Primary action** — **"Find something like this"** on a card: starts a recommendation session seeded with that game's `genre_tags` / `mood_tags` (pre-fills the rec inputs and navigates to results).
- **Backend** — `GET /signals/worked` in `routes_signals.py` (auth-required, like `/history`): returns the user's positive-signal records (`worked`, `played_loved`, `accepted`) with game title + context, newest first. Delegates to `signal_service` (add `get_positive_signals(user_id, limit)`).
- **Engine boost** — add optional `favor_history: bool` to `RecommendationRequest`. When true (premium only), `recommendation_service` builds a lightweight **taste profile** from the user's positive signals — a frequency map of favored `genre_tags` and `mood_tags` — and adds a bounded scoring boost in `_score_games` for games matching that profile. Deterministic; off by default; no effect for users with no history.

### C. Advanced Filters (premium)
Premium-gated filters added to `OptionalFiltersScreen.js`. Free users see them rendered but locked (lock icon + soft upsell on tap).

| Filter | Backed by |
|---|---|
| Stop-friendliness (`anytime` / `checkpoints` / `commitment`) | `game.stop_friendliness` |
| Time-to-fun (`short` / `medium` / `long`) | `game.time_to_fun` |
| "Only on my subscriptions" (Game Pass, PS Plus, …) | `game.subscription_services` |
| "Hide games I've played" | user signals (`accepted`, `played_*`) |

- **Backend** — extend `RecommendationRequest` (`models/recommendation.py`) with optional `stop_friendliness`, `time_to_fun`, `on_subscriptions` (list), `exclude_played` (bool). Apply them in `recommendation_service._apply_filters`. For `exclude_played`, extend `_get_user_game_history` (or add a sibling) to include `played_loved` / `played_neutral` / `played_didnt_stick` in addition to `accepted`.
- Filters are additive to the existing fallback hierarchy (PRD §5.6) — if an advanced filter yields nothing, relax it with a transparent message, same as existing filters.

### D. Paywall redesign + contextual upsells — `mobile-app/src/screens/PremiumScreen.js`
- Rewrite the value props to **lead with Smart History + Advanced Filters**; ad-free becomes a secondary bullet.
- **Lifetime one-time** is the hero card ("Best Value — yours forever"); monthly/annual shown as smaller secondary options. Uses existing `getPackageByType` / `formatPrice`.
- **Soft upsell entry points** (per MONETIZATION.md — never interrupt the core flow):
  1. Tapping a locked Advanced Filter.
  2. Opening Smart History while not premium.
  3. A gentle, dismissible prompt *after* a "this worked for me" signal: *"Want to save what works and get sharper picks?"* (shown at most once per N days, stored in AsyncStorage).
- All upsells route to the redesigned `PremiumScreen`.

### E. Login handling
Smart History and sync require an account (signals history is auth-gated). Tapping these while anonymous shows a "Sign in to unlock your history" step (Google/Apple already supported via `AuthContext`). Premium purchased while anonymous still works (RevenueCat restores on login); the gated screens prompt sign-in to populate data. Never a dead end.

### F. Ads
No change to `AdContext` / `adService`. Free users keep the rewarded-ad reroll past the daily cap. `canReroll()` already returns true for everyone; premium continues to skip the ad gate via `shouldShowAdBeforeReroll(isPremium)`.

## Data / model changes
- `RecommendationRequest` gains optional: `stop_friendliness`, `time_to_fun`, `on_subscriptions`, `exclude_played`, `favor_history`. All default to none/false so existing free behavior is unchanged.
- **No Firestore schema changes** — `user_signals` (with `context`) and game metadata already contain everything needed.

## Error handling
- Premium feature calls degrade gracefully: if RevenueCat/network fails, treat the user as non-premium (no crash), matching the existing silent-fail pattern in `PremiumContext`.
- Anonymous access to a premium feature always routes to sign-in, never a dead end.
- Advanced filters that match nothing fall through the existing transparent fallback hierarchy.
- `favor_history` with no signals is a no-op (no boost), not an error.

## Testing
- **Engine unit tests** (`tests/test_recommendation_service.py`), mocked data:
  - `stop_friendliness` filter returns only matching games; same for `time_to_fun`.
  - `on_subscriptions` filter returns only games whose `subscription_services` intersect the requested list.
  - `exclude_played` removes games the user has `accepted` / `played_*`.
  - `favor_history`: a user whose positive signals favor cozy/low-energy genres gets those games scored higher than without the flag (patch `random.uniform` to isolate, per existing pattern).
- **Gating test**: `hasFeature('advancedFilters')` is false for a non-premium user (mobile unit test).
- **Backend**: `GET /signals/worked` returns only positive-signal types for the authenticated user.

## Out of scope (v1)
- ML / collaborative-filtering personalization (heuristic boost only).
- Social or shared lists.
- The affiliate "jump to play" revenue stream (separate effort).
- Changing the ad mechanic itself (only its role in the premium pitch).
- New cross-device-sync infrastructure (relies on existing login + server-side signals/saved-games).

## Success metrics
- Free → premium conversion rate (target the doc's 3–5%, measured against the new value tier).
- Premium feature engagement: % of premium users who open Smart History / use an advanced filter.
- "This worked for me" → upsell view → purchase funnel.
- Guardrail: core-flow completion and reroll rates for free users must not drop (the rebuild must not add friction to the free experience).
