# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name

**PlayNxt**

## Tagline

*What should I play right now?*

---

## Document Status

**Last reconciled against shipped code: 2026-08-19.**

This document describes **what PlayNxt actually does today**, not the original MVP intent. It was rewritten because the previous version had drifted far enough from the build to be actively misleading — it listed ads, payments, and wishlists as out of scope while all three were shipping, and specified an authentication method that was never built.

Conventions used below:

| Badge | Meaning |
|---|---|
| **[SHIPPED]** | In the live App Store / Play build |
| **[BACKEND-ONLY]** | API is live; not yet visible in the shipped mobile build (see `ROADMAP.md` Phase 1) |
| **[PLANNED]** | Not built |
| **[DEFECT]** | Specified behavior that does not currently work |

**When you change behavior, update this document in the same PR.** The drift this file just recovered from is what produced a store listing describing features that do not exist.

---

## 1. Product Definition

PlayNxt is a time-aware, mood-aware **video game** recommendation app that helps adult gamers quickly decide what to play right now by returning 1–3 confident, explainable recommendations.

The product optimizes for **decision confidence**, not browsing or discovery depth.

> PlayNxt recommends **video games** for PC and console. It is not a board game app — that is PlayCompass, a separate product.

---

## 2. Target Audience

### Primary

- Adult gamers (ages ~25–45)
- PC and console players
- Limited or fragmented playtime

### Out of Scope

- Kids
- Roblox ecosystem
- Competitive esports-first players

---

## 3. Core Product Principles (Must Be Enforced)

1. Time available is always required input
2. Energy/mood is always required input
3. Platform input is optional and must never block results
4. Maximum of 3 recommendations per session (`max_recommendations: int = 3`, `api-service/src/core/config.py:62`)
5. Every recommendation must include a clear explanation
6. **No account required to get a recommendation.** Sign-in exists but is optional and is never a gate on the core loop
7. Preference learning must be lightweight and contextual
8. Simple, explainable heuristics over machine learning

---

## 4. User Flow

### 4.1 Entry **[SHIPPED]**

**Primary CTA:** "What should I play?"

### 4.2 Inputs **[SHIPPED]**

#### Required Inputs

**Time Available** — `TimeSelectScreen.js`
| Option | Value |
|--------|-------|
| Quick | 15 minutes |
| Short | 30 minutes |
| Standard | 60 minutes |
| Extended | 90 minutes |
| Long | 2+ hours |

**Energy/Mood** — `MoodSelectScreen.js`
| Option | Description |
|--------|-------------|
| Wind down | Low energy, relaxing |
| Casual | Light engagement, easygoing |
| Focused | Immersed, attentive |
| Intense | High energy, challenging |

#### Optional Inputs — `OptionalFiltersScreen.js`

**Play Style** (default: Any): Narrative, Action, Puzzle/Strategy, Sandbox/Creative, Any

**Platform** (default: Any): PC, Console, Handheld, Any
Surfaced to users as PC, PlayStation, Xbox, Nintendo Switch, and Steam Deck.

**Session Type** (default: Solo): Solo, Couch co-op, Online with friends (`online_friends`), Any

**Discovery Toggle** (default: Familiar) — `DiscoveryMode` enum, `api-service/src/models/recommendation.py:32`
| Option | Behavior (Anonymous) | Behavior (With History) |
|--------|---------------------|------------------------|
| Familiar | Well-known, highly-rated titles | Games similar to positive signals |
| Surprise me | Lesser-known or genre-adjacent titles | Boost undiscovered categories |

### 4.3 Recommendation Output **[SHIPPED]**

Return 1–3 games. Each recommendation includes:

| Field | Description | Required |
|-------|-------------|----------|
| Game title | Name of the game | Yes |
| Platform(s) | Available platforms | Yes |
| Short description | 1–2 lines | Yes |
| Why this fits right now | Contextual explanation, shown as "Why this game?" | Yes |
| Time-to-fun | `short` / `medium` / `long` | Yes |
| Stop-friendliness | `anytime` / `checkpoints` / `commitment` | Yes |
| Subscription availability | Game Pass, PS Plus, EA Play | If applicable |
| Store link | Affiliate-wrapped where configured (see §11) | If applicable |

### 4.4 User Actions **[SHIPPED]**

| Action | Effect |
|--------|--------|
| Accept a recommendation | Logs acceptance (`rec_accepted`), closes session |
| Reroll | Returns a fresh set. Free tier is capped — see §10 |
| Tap a card | Opens `GameDetailScreen` with full reasoning and store links |
| Start over | Resets inputs and returns to the time selector |
| "Played before" (optional) | Opens played status options |

> **Do not treat these as button labels.** Store and marketing copy must quote strings that actually exist in the build. A prior App Store description invented a "Let's Play" button that was never implemented.

---

## 5. Recommendation Engine Requirements

### 5.1 Platform Handling

- Platform input is optional; default `Any`
- If platform is selected → filter strictly
- If not selected → rank cross-platform games higher
- Platform must influence ranking, not only filtering

### 5.2 Filtering Rules

Filter games by time, energy/mood, play style (if specified), platform (if specified), and session type.

### 5.3 Ranking Heuristics **[SHIPPED]**

Implemented in `_score_games`, `api-service/src/services/recommendation_service.py`:

| Signal | Boost range |
|---|---|
| Stop-friendliness | 0–0.25 |
| Time-to-fun | 0–0.20 |
| Mood match | 0–0.20 |
| Genre match | 0–0.15 |
| Platform match | 0–0.10 |
| Subscription availability | 0–0.10 |
| Randomization (variety between rerolls) | 0–0.15 (`RANDOM_VARIETY_RANGE`) |

**The ranking score is deliberately uncapped.** The deterministic boosts total 1.00 (1.15 with the premium taste profile), so clamping the ranking score to 1.0 pinned every strong match to exactly 1.0 and let weaker games tie them. Clamping to the API's `ge=0.0, le=1.0` contract happens only at response build, where `score` becomes the user-facing `match_score`.

The randomization term is intentionally narrow. Reroll freshness comes from hard-excluding already-shown games (§5.5), not from shuffling scores. At the previous 0.30 width, a game fitting 0.20 worse still won roughly 17% of the time.

Two post-scoring passes then apply:
- **Franchise diversity** — `_ensure_franchise_diversity` prevents a single series from filling all three slots
- **Surprise boost** — `_apply_surprise_boost` when `discovery_mode = surprise`

### 5.4 Output Rules

- Return 1–3 games only
- Never return empty results (see 5.6)
- Explanation text is mandatory
- Deterministic apart from the explicit randomization term above

### 5.5 Repeat Visit Handling

- Games already shown in the session are passed back as `excluded_game_ids`
- Deprioritize games shown in last 7 days
- Games the user accepted are exempt from deprioritization

### 5.6 Empty Result Fallback Hierarchy

Relax constraints in order: exact match → relax platform → relax play style → relax time (± one bracket) → partial match with an explanation of the compromise.

Fallback explanations must be transparent:
> "No exact matches for 15-minute competitive handheld games. Here are some great 30-minute options instead."

---

## 6. Game Catalog **[SHIPPED]**

**Current size:** ~1,089 games validated in production Firestore (per `ROADMAP.md`). The seed files in `api-service/scripts/games_data/` hold 826 across five mood-partitioned files:

| File | Games |
|---|---|
| `mobile.json` | 274 |
| `wind_down.json` | 159 |
| `casual.json` | 140 |
| `intense.json` | 128 |
| `focused.json` | 125 |

Original MVP target was 200–300 and post-MVP 500+. Both are long since exceeded; **catalog size is no longer a roadmap constraint.** Remaining work is coverage and metadata quality, not volume.

Cover art is sourced from the RAWG API.

### Inclusion Criteria

- Widely accessible
- Respects player time
- Works well in short or chunked sessions
- Available on at least one major platform

### Exclusions

- Games requiring long uninterrupted sessions (unless tagged appropriately)
- Heavy live-service grind games (unless explicitly time-safe)
- Early access games with unstable session lengths

---

## 7. Game Metadata Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `game_id` | string | Unique identifier |
| `title` | string | Game name |
| `platforms` | array | `[pc, console, handheld]` |
| `release_year` | number | Year of release |
| `genre_tags` | array | Genre classifications |
| `time_tags` | array | `[15, 30, 60, 90, 120+]` compatible session lengths |
| `energy_level` | enum | `low` \| `medium` \| `high` |
| `mood_tags` | array | Mood/vibe descriptors |
| `play_style` | array | `[narrative, action, puzzle_strategy, sandbox_creative]` |
| `time_to_fun` | enum | `short` \| `medium` \| `long` |
| `stop_friendliness` | enum | `anytime` \| `checkpoints` \| `commitment` |
| `multiplayer_modes` | array | `[solo, local_coop, online_coop, competitive]` |
| `description_short` | string | 1-2 sentence description |
| `explanation_templates` | object | Structured explanation components |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `avg_session_length` | number | Average session in minutes |
| `subscription_services` | array | `[game_pass, ps_plus, ea_play]` |
| `content_warnings` | array | Mature theme indicators |

Explanations are composed dynamically from relevant templates:
> "Vampire Survivors fits your 30 minutes perfectly. Low-stakes gameplay for winding down, and you can quit anytime."

---

## 8. User Preference Signals

### 8.1 Design Rule

Users must never be asked to "build a profile." Preferences are inferred from lightweight, contextual signals only.

### 8.2 Explicit Signals **[SHIPPED]**

**A. "This worked for me"** — shown after a user accepts a recommendation:

| Option | Signal Type |
|--------|-------------|
| Loved it | `worked` |
| Not a good fit | `not_good_fit` |

**B. "Played Before"** — optional, non-blocking, on recommendation cards:

| Option | Signal Type |
|--------|-------------|
| Played & loved | `played_loved` |
| Played & it was fine | `played_neutral` |
| Played & didn't stick | `played_didnt_stick` |
| Haven't played | No signal recorded |

### 8.3 Implicit Signals

| Signal | Interpretation |
|--------|----------------|
| Reroll count | High rerolls = poor match quality |
| Recommendation acceptance | Positive signal for game + context combo |
| Time to decision | Quick acceptance = confident match |

### 8.4 How Signals Affect Recommendations

**This is narrower than it appears and must not be overstated in marketing copy.**

A taste profile is built from positive signals (`WORKED`, `PLAYED_LOVED`, `ACCEPTED`) **only when both conditions hold**:

1. The request sets `favor_history` (the premium "Sharper Picks" behavior), and
2. A `user_id` exists — i.e. the user is signed in

It is an explicit no-op for anonymous users. See `recommendation_service.py:119-139`.

**Consequence:** for a signed-out free user — the default — recommendations do **not** get smarter over time. Do not claim otherwise on a store listing.

### 8.5 Excluded Signals

- Star ratings
- Genre surveys
- Playtime tracking
- Social features
- Library syncing

---

## 9. Saved Games / Buckets **[SHIPPED]**

Previously listed as out of scope ("wishlist functionality"). It shipped. Defined in `mobile-app/src/context/SavedGamesContext.js`:

| Bucket | Intent |
|---|---|
| Backlog | Games to play later |
| Playing | Currently playing |
| Played | Finished or tried |
| Not For Me | Skip in recommendations |

**[DEFECT] "Not For Me" does not currently filter anything.** No code path, client or server, excludes that bucket from recommendations. The client sends only session-shown games as `excluded_game_ids`, and `not_for_me` appears nowhere in `recommendation_service.py`. The UI promises "Skip in recommendations", so either the behavior or the label must change. Fix in progress.

This is deliberately *light* tracking. PlayNxt does not log play sessions, track playtime, or maintain stats, and should not grow into a backlog manager — that space is already saturated (see `ASO-PLAN.md` section 2).

---

## 10. Monetization **[SHIPPED]**

Previously listed as out of scope ("Ads", "Subscriptions / payments"). Both ship today.

### Free tier

- Ad-supported (`adService.js`, `AdContext.js`), with interstitials before some rerolls
- **10 rerolls per day** (`DAILY_REROLL_CAP = 10`, `mobile-app/src/utils/rerollCap.js`); hitting the cap triggers `DailyCapUpsellModal`
- iOS shows the App Tracking Transparency prompt before personalized ads (`expo-tracking-transparency`)
- Ads have a remote kill switch: `ads_enabled` via `RemoteConfigService`

### Premium — one-time $1.99 unlock

| Feature | Status |
|---|---|
| No Ads | **[SHIPPED]** |
| Unlimited rerolls | **[SHIPPED]** |
| Smart History ("What's worked for you") | **[BACKEND-ONLY]** |
| Advanced Filters (`stop_friendliness`, `time_to_fun`, `on_subscriptions`, `exclude_played`) | **[BACKEND-ONLY]** |
| Sharper Picks (`favor_history` scoring boost) | **[BACKEND-ONLY]** |
| Cross-Device Sync | **[BACKEND-ONLY]** |

> **A user paying $1.99 today receives ad removal and unlimited rerolls only.** The other four are backend-live but absent from the shipped mobile build. `PremiumScreen.js` shows a "Premium features are on the way" placeholder. Store copy must not advertise the backend-only rows until `ROADMAP.md` Phase 1 ships.

---

## 11. Affiliate Links **[SHIPPED]**

Previously scheduled for Phase 3; already live. `affiliateService.js` wraps store links (Steam, Epic, Xbox and others) and is wired into `GameDetailScreen.js` and `GameCard.js`.

**Constraint retained: affiliate relationships must never influence ranking.** No affiliate term appears in `_score_games`, and it must stay that way.

---

## 12. Notifications **[BACKEND-ONLY]**

- Push registration: `registerForPushNotifications()`, `notificationService.js`
- **Weekly digest** — Cloud Scheduler, Saturdays 17:00 UTC. Currently reaching zero devices; no shipped build registers for push
- **Follow-up queue** — prompts for feedback 22 hours after an acceptance (`FOLLOWUP_DELAY_HOURS = 22`, `followup_service.py`)

---

## 13. Authentication **[SHIPPED]**

The prior spec called for "email + magic link, no passwords." **That was never built.** Actual implementation:

- Email + **password** (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`)
- **Sign in with Google**
- **Sign in with Apple**

Screens: `SignInScreen.js`, `EmailSignInScreen.js`. Sign-in remains fully optional and never blocks a recommendation. It enables cross-device persistence and is a precondition for history-based personalization (section 8.4).

---

## 14. Analytics **[SHIPPED]**

Firebase Analytics (`@react-native-firebase/analytics`) via `analyticsService.js`. Events currently emitted:

| Event | Enables |
|---|---|
| `rec_requested` | Denominator for acceptance rate |
| `rec_accepted` | Acceptance rate (target >40%) |
| `rec_feedback` | "This worked for me" rate (target >60%) |
| `paywall_viewed` | Paywall to purchase conversion |
| `purchase_started` / `_completed` / `_cancelled` / `_failed` | Purchase funnel (target 3-5%) |
| `ad_watched` | Ad load / fill |
| `att_result` | ATT opt-in rate, which bounds ad revenue |

**Every success metric in section 16 is measurable today.** No further instrumentation is needed to decide whether retention justifies more premium investment.

---

## 15. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Recommendation response time | < 1 second |
| Fallback availability | Cached results if backend unavailable |
| Privacy | "We don't track your playtime" — still true; do not add playtime tracking without revisiting this claim |
| Testability | Deterministic apart from the bounded section 5.3 randomization term (0–0.15) |
| Accessibility | WCAG 2.1 AA compliance |

---

## 16. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Recommendation acceptance rate | > 40% | `rec_accepted` / `rec_requested` |
| Weekly repeat usage | > 25% | Users returning within 7 days |
| Reroll frequency | < 2 per session | Average rerolls before accept/exit |
| "This worked for me" rate | > 60% | Positive / total feedback |
| Time to decision | < 30 seconds | Input complete to acceptance |
| Free to premium conversion | 3-5% | `purchase_completed` / `paywall_viewed` |

---

## 17. Still Out of Scope

Verified absent from the codebase as of 2026-08-19:

- Machine learning models (no `sklearn` / `tensorflow` anywhere)
- Game price tracking
- Steam / Xbox / PlayStation **library syncing** (still [PLANNED], `ROADMAP.md` Phase 3)
- Social features — no friends, followers, or feeds. `ProfileScreen` is explicitly "a settings panel, not a social profile", and `online_friends` is only a session-type filter value
- Reviews or user ratings

---

## 18. Roadmap Position

`ROADMAP.md` is the source of truth for sequencing. In summary:

- **Phase 1** — get the [BACKEND-ONLY] features above into a shipped build. Blocked on iOS CI credentials
- **Phase 2** — "Why not?" explanations, broader preference inference, Smart History UI. Partially built: the taste profile in section 8.4 exists but is gated
- **Phase 3** — library syncing. Affiliate links, originally scoped here, already shipped
- **Phase 4** — anonymous aggregate stats, curated context lists

---

## 19. North Star

**PlayNxt helps gamers stop deciding and start playing by delivering confident, time-aware recommendations with minimal friction.**

---

## Appendix A: Example Recommendation Flow

**User Input:** Time 30 minutes, Energy Wind down, Play Style Any, Platform PC, Session Solo, Discovery Familiar

**System Response:**

> ### Vampire Survivors
> **PC, Console, Handheld** - Action Roguelike
>
> Mow down thousands of monsters in this hypnotic auto-battler. No complex controls, just satisfying chaos.
>
> **Why this fits:** Quick runs fit perfectly in 30-minute windows. Low-stakes gameplay for winding down, and you can quit anytime.
>
> Time-to-fun: Short - Stop: Anytime - Game Pass

---

## Appendix B: Metadata Example

```yaml
game_id: "vampire-survivors"
title: "Vampire Survivors"
platforms: [pc, console, handheld]
release_year: 2022
genre_tags: [roguelike, action, arcade]
time_tags: [15, 30, 60]
energy_level: low
mood_tags: [relaxing, satisfying, hypnotic]
play_style: [action]
time_to_fun: short
stop_friendliness: anytime
multiplayer_modes: [solo, local_coop]
description_short: "Mow down thousands of monsters in this hypnotic auto-battler. No complex controls, just satisfying chaos."
explanation_templates:
  time_fit: "Quick runs fit perfectly in {time}-minute windows"
  mood_fit: "Low-stakes gameplay for winding down"
  stop_fit: "Quit anytime, progress auto-saves"
  style_fit: "Pure action with zero complexity"
avg_session_length: 25
subscription_services: [game_pass]
content_warnings: []
```
