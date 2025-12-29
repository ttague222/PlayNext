# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Product Name

**PlayNxt**

## Tagline

*What should I play right now?*

---

## 1. Product Definition

PlayNxt is a time-aware, mood-aware game recommendation app that helps adult gamers quickly decide what to play right now by returning 1–3 confident, explainable recommendations.

The product optimizes for **decision confidence**, not browsing or discovery depth.

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
4. Maximum of 3 recommendations per session
5. Every recommendation must include a clear explanation
6. No account required for MVP
7. Preference learning must be lightweight and contextual
8. Simple, explainable heuristics over machine learning

---

## 4. User Flow (MVP)

### 4.1 Entry

**Primary CTA:** "What should I play?"

### 4.2 Inputs

#### Required Inputs

**Time Available**
| Option | Value |
|--------|-------|
| Quick | 15 minutes |
| Short | 30 minutes |
| Standard | 60 minutes |
| Extended | 90 minutes |
| Long | 2+ hours |

**Energy/Mood**
| Option | Description |
|--------|-------------|
| Wind down | Low energy, relaxing |
| Casual | Light engagement, easygoing |
| Focused | Immersed, attentive |
| Intense | High energy, challenging |

#### Optional Inputs

**Play Style** (default: Any)
| Option |
|--------|
| Narrative |
| Action |
| Puzzle/Strategy |
| Sandbox/Creative |
| Any |

**Platform** (default: Any)
| Option |
|--------|
| PC |
| Console |
| Handheld |
| Any |

**Session Type** (default: Solo)
| Option |
|--------|
| Solo |
| Couch co-op |
| Online with friends |
| Any |

**Discovery Toggle** (default: Familiar)
| Option | Behavior (Anonymous) | Behavior (With History) |
|--------|---------------------|------------------------|
| Familiar | Well-known, highly-rated titles | Games similar to positive signals |
| Surprise me | Lesser-known or genre-adjacent titles | Boost undiscovered categories |

### 4.3 Recommendation Output

Return 1–3 games.

Each recommendation must include:

| Field | Description | Required |
|-------|-------------|----------|
| Game title | Name of the game | Yes |
| Platform(s) | Available platforms | Yes |
| Short description | 1–2 lines | Yes |
| Why this fits right now | Contextual explanation | Yes |
| Time-to-fun | `short` / `medium` / `long` | Yes |
| Stop-friendliness | `anytime` / `checkpoints` / `commitment` | Yes |
| Subscription availability | Game Pass, PS Plus, etc. | If applicable |

### 4.4 User Actions

| Action | Effect |
|--------|--------|
| "I'll play this" | Logs acceptance, closes session |
| "Give me another option" | Rerolls recommendations |
| "Played before" (optional) | Opens played status options |

---

## 5. Recommendation Engine Requirements

### 5.1 Platform Handling

- Platform input is optional
- Default platform value is `Any`
- If platform is selected → filter strictly
- If platform is not selected → rank cross-platform games higher
- Platform must influence ranking, not only filtering

### 5.2 Filtering Rules

Filter games by:
1. Time compatibility
2. Energy/mood compatibility
3. Play style compatibility (if specified)
4. Platform compatibility (if specified)
5. Session type / multiplayer mode compatibility

### 5.3 Ranking Heuristics

Boost ranking for games that have:
- High stop-friendliness
- Short time-to-fun
- Strong mood match
- Strong play style match
- Broad platform availability
- Low friction to start
- Subscription service availability (Game Pass, PS Plus)

### 5.4 Output Rules

- Return 1–3 games only
- Never return empty results (see 5.6 for fallback logic)
- Explanation text is mandatory
- Deterministic logic (no ML required)

### 5.5 Repeat Visit Handling

- Track recently shown games (session/local storage for anonymous users)
- Deprioritize games shown in last 7 days
- Games selected via "I'll play this" are exempt from deprioritization
- Configurable staleness window per user (post-MVP)

### 5.6 Empty Result Fallback Hierarchy

When filters match no games, relax constraints in this order:

1. **Exact match** — All filters applied strictly
2. **Relax platform** — Remove platform filter, keep others
3. **Relax play style** — Remove play style filter
4. **Relax time** — Expand to adjacent time bracket (± one level)
5. **Partial match** — Show best available matches with explanation of compromises

Fallback explanations must be transparent:
> "No exact matches for 15-minute competitive handheld games. Here are some great 30-minute options instead."

---

## 6. Game Catalog

### 6.1 Size

**MVP target:** 200–300 curated games

**Post-MVP target:** 500+ games

### 6.2 Inclusion Criteria

- Widely accessible
- Respects player time
- Works well in short or chunked sessions
- Available on at least one major platform

### 6.3 Exclusions

- Games requiring long uninterrupted sessions (unless tagged appropriately)
- Heavy live-service grind games (unless explicitly time-safe)
- Early access games with unstable session lengths

---

## 7. Game Metadata Schema

Each game must include:

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
| `description_short` | string | 1–2 sentence description |
| `explanation_templates` | object | Structured explanation components |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `avg_session_length` | number | Average session in minutes |
| `subscription_services` | array | `[game_pass, ps_plus, ea_play, etc.]` |
| `content_warnings` | array | Mature theme indicators |

### Explanation Template Structure

```yaml
explanation_templates:
  time_fit: "Quick runs fit perfectly in {time} windows"
  mood_fit: "Low-stakes gameplay for winding down"
  stop_fit: "Save anywhere—quit guilt-free"
  style_fit: "Compelling narrative you can digest in chunks"
  session_fit: "Great for solo sessions"
```

Explanations are composed dynamically from relevant templates:
> "Vampire Survivors fits your 30 minutes perfectly. Low-stakes gameplay for winding down, and you can quit anytime."

---

## 8. User Preference Signals (MVP)

### 8.1 Design Rule

Users must never be asked to "build a profile."
Preferences are inferred from lightweight, contextual signals only.

### 8.2 Explicit Signals

#### A. "This worked for me" (Primary)

Shown only after a user accepts a recommendation:

| Option | Signal Type |
|--------|-------------|
| 👍 This worked for me | `worked` |
| 👎 Not a good fit | `not_good_fit` |

#### B. "Played Before" (Secondary)

Optional button on recommendation cards:

| Option | Signal Type |
|--------|-------------|
| Played & loved | `played_loved` |
| Played & it was fine | `played_neutral` |
| Played & didn't stick | `played_didnt_stick` |
| Haven't played | No signal recorded |

This must be **optional and non-blocking**.

### 8.3 Implicit Signals

| Signal | Interpretation |
|--------|----------------|
| Reroll count | High rerolls = poor match quality |
| Recommendation acceptance | Positive signal for game + context combo |
| Time to decision | Quick acceptance = confident match |

### 8.4 Excluded Signals

- Star ratings
- Genre surveys
- Playtime tracking
- Social features
- Library syncing (MVP)

### 8.5 Signal Data Model

```
UserGameSignal
├── user_id: string (nullable for anonymous users)
├── session_id: string (for anonymous tracking)
├── game_id: string
├── signal_type: enum
│   ├── worked
│   ├── not_good_fit
│   ├── played_loved
│   ├── played_neutral
│   ├── played_didnt_stick
│   └── skipped
├── context: object
│   ├── time_selected: number
│   ├── mood_selected: string
│   └── play_style_selected: string (nullable)
└── timestamp: datetime
```

---

## 9. Authentication (Post-MVP)

- Optional login only
- Email + magic link
- No passwords
- Enables cross-device preference persistence
- Converts anonymous session signals to user account

---

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Recommendation response time | < 1 second |
| Fallback availability | Cached results if backend unavailable |
| Privacy | Clear messaging ("We don't track your playtime") |
| Testability | Deterministic, reproducible logic |
| Accessibility | WCAG 2.1 AA compliance |

---

## 11. Out of Scope (MVP)

- Steam / Xbox / PlayStation account syncing
- Social features
- Reviews or ratings
- Ads
- Subscriptions / payments
- Machine learning models
- Game price tracking
- Wishlist functionality

---

## 12. Success Metrics

### Primary Metrics

| Metric | MVP Target | Measurement |
|--------|------------|-------------|
| Recommendation acceptance rate | > 40% | Accepted / Total shown |
| Weekly repeat usage | > 25% | Users returning within 7 days |
| Reroll frequency | < 2 per session | Average rerolls before accept/exit |

### Secondary Metrics

| Metric | MVP Target | Measurement |
|--------|------------|-------------|
| "This worked for me" rate | > 60% | Positive / Total feedback given |
| Time to decision | < 30 seconds | Input complete → acceptance |
| Session completion rate | > 70% | Users who accept or explicitly exit |

### Qualitative Indicators

- Users report faster decisions
- Users say recommendations feel "obvious" or "right"
- Users describe the experience as "low friction"

---

## 13. Post-MVP Roadmap

### Phase 2: Enhanced Personalization
- "Why not?" feature — tap skipped games to see reasoning and provide negative signals
- Expanded preference inference from usage patterns
- Configurable recommendation staleness window

### Phase 3: Platform Integration
- Optional Steam library sync
- Optional Xbox/PlayStation library sync
- Game Pass / PS Plus catalog awareness

### Phase 4: Community Features
- Anonymous aggregate data ("87% of users played this for 30 min sessions")
- Curated lists by context (e.g., "Best for winding down")

---

## 14. North Star

**PlayNxt helps gamers stop deciding and start playing by delivering confident, time-aware recommendations with minimal friction.**

---

## Appendix A: Example Recommendation Flow

**User Input:**
- Time: 30 minutes
- Energy: Wind down
- Play Style: Any
- Platform: PC
- Session: Solo
- Discovery: Familiar

**System Response:**

> ### Vampire Survivors
> **PC, Console, Handheld** · Action Roguelike
>
> Mow down thousands of monsters in this hypnotic auto-battler. No complex controls, just satisfying chaos.
>
> **Why this fits:** Quick runs fit perfectly in 30-minute windows. Low-stakes gameplay for winding down, and you can quit anytime.
>
> ⏱ Time-to-fun: Short · 🛑 Stop: Anytime · 🎮 Game Pass

**User Actions:**
- [I'll play this] [Give me another option]
- [Played before ▾]

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
  stop_fit: "Quit anytime—progress auto-saves"
  style_fit: "Pure action with zero complexity"
avg_session_length: 25
subscription_services: [game_pass]
content_warnings: []
```
