# Seasonal Themes — Design Spec

**Date:** 2026-10-20
**Source briefs:** `seasonal-themes-brief-for-claude.md` (light-touch version) and
`seasonal-themes-brief-for-claude (1).md` (full version with calendar), both from
Tom's Downloads. Where they disagree, this spec records what was decided.
**Repos touched:** `PlayNxt` (api-service, mobile-app), `playnxt-web` (quiz only).

---

## 1. Intent

Make PlayNxt feel alive year-round without an app release per season. Two parts:

1. **Seasonal collections:** a Seasonal card on the Play home screen that surfaces
   the current season's collection(s), e.g. "Games for the long weekend" in
   November. Each collection is a framing (title + blurb, Tom's copy) on top of a
   fixed set of quiz parameters. The engine supplies the games.
2. **Seasonal palettes:** the main flow (home, quiz, results) takes on the
   season's backgrounds, glows and a secondary accent, while the brand pink stays
   on everything interactive.

It builds on the seasonal scenario pages already on playnxt.io (cozy October).

## 2. Decisions already made (by Tom, 2026-10-20)

- **Seasonal app icons: out of scope for now.** (iOS shows a system alert on every
  change; all icons must ship in the binary.)
- **App-wide palettes: yes**, via a new token system, scoped to the main flow.
- **Hybrid palette rule (from the UX review, accepted by Tom):** brand pink
  `#f857a6 → #ff5858` stays on every tappable/selected element (primary buttons,
  selected chips, match %, spinner). Seasons override backgrounds, decorative
  circles and glows, a non-interactive secondary accent, and the optional header
  illustration. Reason: the four mood colors (`#7c3aed` Wind Down, `#06b6d4`
  Casual, `#f59e0b` Focused, `#ef4444` Intense) and the semantic colors
  (`#4ade80` success, `#fbbf24` rating) already occupy the seasonal hues; white
  text fails on every seasonal accent; the icon, store art, web quiz and share
  cards stay pink all year.
- **Share card does not take the seasonal palette.** Shares outlive their season
  and are seen next to the pink icon. Its gradient becomes a token (locked).

## 3. Goals, non-goals, anti-goals

**Goals**
- Adding or changing a season is a content change plus an API deploy, never an
  app release.
- Every pick shown in a collection is a real engine output for that collection's
  parameters.
- The app shows the right season even when the fetch fails (bundled fallback).
- Seasonal palettes can't ship if they fail contrast; the app falls back to the
  default palette if a delivered palette fails at runtime.
- Analytics can attribute recommendation outcomes to a collection.

**Non-goals (this round)**
- Seasonal app icons.
- Theming the side screens (Profile, Premium, sign-in, Help, History, Steam,
  modals' backgrounds). They use tokens for the locked brand colors only.
- Seasonal theming of the web quiz.
- A remote-driven genre list. (Horror is already a chip; see §8.)
- Hand-picked games anywhere in the app.

**Anti-goals (failure even if it "works")**
- A stale config keeping Spooky colors into December.
- A season that makes "selected" or "go" hard to recognize, or that collides with
  a mood or status color.
- A collection whose title promises something its parameters can't deliver
  (e.g. "couch co-op" backed by online-only games).
- The default palette looking different from today, apart from the accessibility
  fixes in §6.4.

## 4. Season content: one file, served by the API

**My call:** the content lives in `api-service/src/content/seasonal.json`, is
validated by a Pydantic model at API startup and in tests, and is served at
`GET /api/seasonal`. Reasons: the app already depends only on the API host; the
API can validate `energy_mood`, `session_type` and genre ids against its own
enums; `api-deploy.yml` already deploys on push to `main` under `api-service/**`.
(The in-memory `POST /api/config` is not suitable: changes vanish on restart and
differ across Cloud Run instances.)

### 4.1 Shape

```jsonc
{
  "schema_version": 1,
  "seasons": [
    {
      "id": "harvest-2026",                 // year-scoped so analytics separate years
      "name": "Harvest",
      "starts": "2026-11-01",               // inclusive, device-local date
      "ends":   "2026-11-30",               // inclusive
      "palette": { /* §6.2 seasonal roles only */ },
      "header_image": { "url": "https://…", "alt": "…" },   // optional
      "collections": [
        {
          "id": "harvest-2026-long-weekend",
          "title": "Games for the long weekend",
          "blurb": "…",                     // one line, Tom's copy
          "params": {
            "time_available": 60,
            "energy_mood": "casual",
            "genres": null,
            "session_type": "couch_coop",
            "discovery_mode": "familiar"
          },
          "starts": null, "ends": null      // optional micro-moment window inside the season
        }
      ]
    }
  ]
}
```

- At most **2 collections visible** at once. A collection with its own window
  (e.g. Valentine's, Feb 14) shows only inside that window and takes the first
  slot.
- Seasons must not overlap; gaps are allowed (gap = default palette, no card).
  Validation enforces both.
- `params` accepts the free-tier request fields only: `time_available`,
  `energy_mood`, `genres`, `session_type`, `discovery_mode`. Values the quiz
  doesn't expose are allowed (`session_type: "couch_coop"`); that is still real
  engine output. **My call:** premium-gated fields (`on_subscriptions`,
  `stop_friendliness`, `time_to_fun`, `exclude_played`, `favor_history`) and
  `library_only` are rejected by the schema, so a collection never hands free
  users a premium filter and never depends on a synced library. Revisit if a
  "Game Pass this weekend" style collection is wanted.

### 4.1a Calendar

From the full brief's calendar. Dates are inclusive, device-local, and recur
yearly; each year's file carries year-scoped ids.

| Season | Dates | Collections (brief's working titles; Tom writes final copy) | Starting params (validate before use) |
|---|---|---|---|
| Spooky | Sep 1 – Oct 31 | "Spooky season scares"; "Cozy autumn" | 60 + Casual + Horror; 60 + Wind Down |
| Harvest | Nov 1 – Nov 30 | "Games for the long weekend" | 60 + Casual + `couch_coop` |
| Winter Holidays | Dec 1 – Jan 7 | "Holiday break gaming"; "Got new games? Play this first" | 120 + Casual; second needs different params (see note) |
| Deep Winter | Jan 8 – Feb 28 | "Beat the winter blues"; micro-moment Feb 14 "Cozy co-op for two" | 90 + Wind Down; 60 + Casual + `couch_coop` |
| Spring | Mar 1 – Apr 30 | "Fresh starts" | 60 + Focused |
| Summer | May 1 – Aug 31 | "Summer break gaming"; "Games for a long flight" | 120 + Casual; second needs different params |

- **Spooky 2026 is skipped**: October ends before 1.8.0 can ship. The file runs
  Harvest 2026 through Spooky 2027 (§10a).
- Collections built on "with friends" in the brief use `couch_coop` instead,
  because the quiz's "with friends" (`multiplayer`) returns mostly online-only
  games (Garden Paws 11/25, Palia 8/25 on 2026-10-20), which breaks the
  "couch"/"for two" framing.
- Note: Winter Holidays, Summer and the long-flight page share 120 + Casual, and
  Deep Winter shares 90 + Wind Down with the post-travel page. Two collections
  visible at once must have different params, or they show the same games. Tom
  picks the differentiator (a genre, `discovery_mode: "surprise"`, a different
  time) when writing copy; `validate_seasonal.py` confirms it.

### 4.2 Validation

1. **Schema + rules at API startup and in pytest:** enum values, date order, no
   overlap, ≤2 concurrent collections, palette passes the §6.3 checks. A bad file
   fails CI, so it never deploys.
2. **Engine sampling script** `api-service/scripts/validate_seasonal.py`: runs each
   collection's params N times (default 20) against a target API (prod by
   default), fails if any run is empty or uses fallback, and prints a tally of the
   games returned so Tom can check the title matches what the engine actually
   gives. Run it manually before each season's content PR, the same way scenario
   pages are sampled before publishing.

### 4.3 Bundled fallback

`mobile-app/src/config/seasonal.fallback.json` is a copy of the API file at build
time (a script `npm run sync-seasonal` copies it; a jest test fails if they
differ in the repo). It should cover at least 12 months ahead of each release so an
offline app still rotates seasons (1.8.0: Harvest 2026 through Spooky 2027).

## 5. App: Seasonal card and collection sessions

### 5.1 Fetch and selection

- New `src/services/seasonalService.js` (pure logic + storage, no React, same
  pattern as `tonightService.js`): fetch `GET /api/seasonal` on Play focus at most
  every 6 hours, cache the last good payload in AsyncStorage, fall back to the
  bundled file.
- **Season selection runs on the device**, comparing the device-local date to
  `starts`/`ends`. The fetched payload never decides "what's active" by itself,
  so an old cache can't keep a finished season alive.
- Payload that fails client-side shape checks is ignored (use cache, then bundle).

### 5.2 Card

- New `src/components/SeasonalCard.js`, rendered on `PlayScreen` **below the
  TonightCard** (or where the feature pills sit for users with no Tonight card).
  The hero "Start Playing" CTA stays primary.
- Contents per collection: title, blurb, context line from params ("60 min ·
  Casual · Couch co-op"), three cover thumbnails once loaded, optional header
  illustration.
- **Picks are fetched live and cached per collection per local day**, mirroring
  Tonight's Picks: first view of the day runs `/api/recommend` with the
  collection params; the thumbnails are those picks; tapping opens Results with
  the same picks (no second call). Single-flight guard so view + tap don't
  double-fetch.
- **My call:** the user's saved platform filter is applied on top of the
  collection params (a Switch-only user shouldn't get PC-only picks). Everything
  else comes from the collection.
- States: loading shimmer (tappable), quiet inline error with retry, hidden when
  no collection is active.

### 5.3 Session

- `RecommendationContext` gains `startCollectionSession(collection, cachedPicks)`,
  modeled on `startTonightSession`: seeds results, preferences from the
  collection params, `sessionSource = 'seasonal'`, and stores `collectionId`.
- Reroll, accept, swap and share work as today. Free-tier caps and ad gating apply
  exactly as to a normal-flow session (**my call**).
- A collection session does **not** overwrite the saved Tonight's Picks context
  (**my call**), so a one-off seasonal tap doesn't change the user's daily ritual.
- **Runtime fallback (my call):** a live request is narrower than the validated
  one (saved platforms, server-side exclusions for signed-in users, reroll
  exclusions), so the engine can fall back. When `fallback_applied` is true the
  picks still show, with the existing fallback message, exactly as in the normal
  flow (never-empty is a PRD non-negotiable). The guard is upstream:
  `validate_seasonal.py` also runs each collection with each single platform
  filter and reports any that fall back, so a collection too thin to survive
  real-world filters is caught before it ships.

## 6. Theme tokens and seasonal palettes

### 6.1 Mechanism

- `src/theme/tokens.js` (default palette = today's colors), `src/theme/ThemeContext.js`
  (`ThemeProvider`, `useTheme()`), `src/theme/alpha.js` (`alpha(hex, a)` so rgba
  tints derive from tokens instead of literals).
- Screens in scope move their color-bearing styles from module-level
  `StyleSheet.create` into a `useMemo(() => makeStyles(theme), [theme])` per
  screen, or apply theme colors as inline overrides on the few themed elements.
  Builder's choice per file.
- Active palette = default merged with the active season's overrides, chosen on
  device (§5.1). Last good palette is cached so cold start doesn't flash default.

### 6.2 Token roles

| Role | Controls | Season may override |
|---|---|---|
| `bg.gradient` (3 stops) | Screen backgrounds | Yes |
| `bg.decor` | Decorative circles, ambient glows, illustration tint | Yes |
| `accent.season` | Non-interactive highlights: eyebrow text, TonightCard/SeasonalCard border, icon tints | Yes |
| `onAccent.season` | Text on `accent.season` fills | Yes (checked) |
| `overlay.scrim` | GameCard image fade (today `rgba(15,12,41,…)`) | Derived from `bg.gradient[0]` |
| `accent.brand`, `accent.brandEnd` | Primary buttons, selected fill/border, match %, spinner | No |
| `onAccent.brand` | Text on pink | No |
| `glow.brand` | Pink `shadowColor`s and tints | No |
| `text.primary/secondary/muted` | Body text | No |
| `surface.card/chip` | rgba-white overlays | No |
| `semantic.success/error/warning/rating` | Status colors | No |
| `mood.windDown/casual/focused/intense` | Mood identity colors | No |
| `share.gradient` | ShareCard background | No |

### 6.3 Guardrail

Checked in the API's validation (CI) and again on device before applying:

- `#ffffff` on every `bg.gradient` stop ≥ 4.5:1, and `text.secondary` on the
  **middle** stop ≥ 4.5:1 (text sits over the middle, not the darkest stop).
- `accent.brand` on the lightest stop ≥ 3:1 (UI component).
- `onAccent.season` on `accent.season` ≥ 4.5:1.
- **Perceptual distance:** `accent.season` must be at least **ΔE2000 12** from
  every `mood.*`, `semantic.*` and `accent.brand` color. (A plain hue-angle rule
  was rejected: with moods at 262/189/38/0° and success/rating at 142/43°, a 30°
  rule leaves no orange, amber or sky blue at all. ΔE2000 also counts lightness
  and saturation, so pale ice blue `#a8dcf0` passes against saturated Casual cyan
  at 14.8.) Contrast checks can't catch these clashes.
- **Usage limit (pairs with the rule above):** `accent.season` is not used on
  `MoodSelectScreen` or on chips anywhere; those screens take only the seasonal
  background and decor. That keeps the season accent out of the places where mood
  and status colors carry meaning.
- Any failure → that season renders with the default palette (card still shows).
  The device check uses the same function as CI (shared test vectors).

### 6.4 Default palette fixes (ship with tokens)

The UX review found the current default fails AA in places. **My call** to fix in
the same release, since the guardrail would otherwise reject its own fallback:

- Small text on pink fills (e.g. TimeSelect `modePillActive`, 14px) uses dark
  `#0a0a1a` text, or the label goes to ≥18px bold. Large pink buttons keep white.
- `#808080` gray on the Results background (3.22:1) moves to a gray that passes
  on `#302b63`.

### 6.5 Starting palettes (from the UX review; Tom may adjust)

| Season | `accent.season` | `onAccent.season` | `bg.gradient` |
|---|---|---|---|
| Spooky | `#ff8a3d` | `#1a0b00` | `#0d0716` `#22103a` `#2e1546` |
| Harvest | `#f0a33a` | `#1f1300` | `#120a06` `#2a1610` `#3a2114` |
| Winter Holidays | `#7cc4ff` | `#04121f` | `#060d1f` `#0f1e3d` `#1b2b52` |
| Deep Winter | `#a8dcf0` (decor `#ffb867`) | `#062030` | `#070b14` `#101a2a` `#1b2638` |
| Spring | `#ffa3c8` (green lives in bg) | `#2a0716` | `#08120d` `#11261b` `#1a3526` |
| Summer | `#ffd23f` | `#1a1400` | `#06141c` `#0b2a3a` `#0d2f40` |

Measured ΔE2000 to the nearest locked color (2026-10-20): Spooky 13.0 (Focused),
Winter Holidays 14.2 (Casual), Deep Winter 14.8 (Casual), Spring 15.1 (brand)
pass. **Harvest 3.1 (Focused) and Summer 5.5 (rating) fail** and must be moved:
Harvest toward a deeper russet/copper, Summer toward a warmer sun-orange or a
paler butter yellow, re-checking contrast. The builder adjusts them; Tom approves
the final palette for the proof season.

### 6.6 Scope of conversion

Themed (seasonal roles + locked roles): `PlayScreen`, `TimeSelectScreen`,
`MoodSelectScreen`, `OptionalFiltersScreen`, `ResultsScreen`, `GameCard`,
`TonightCard`, `SeasonalCard`.
Locked roles only: the brand gradient `['#f857a6','#ff5858']` everywhere it is
hardcoded (also `AdOrPremiumModal`, `CelebrationModal`, `DailyCapUpsellModal`,
`WelcomeScreen`), and `ShareCard`.
Known hazards to clear: pink rgba literals and `shadowColor`s in the themed files,
the baked purple GameCard scrim, the `#667eea`/`#764ba2` leftovers on PlayScreen
and the GameCard fallback tile.

## 7. Analytics (Firebase)

Extends the existing `pick_source` pattern (`docs/ACTIVATION-TRACKING.md`):

| Event | When | Params |
|---|---|---|
| `seasonal_collection_viewed` (new) | Card for a collection is on screen, once per collection per local day | `collection_id`, `season_id` |
| `seasonal_collection_tapped` (new) | User taps a collection | `collection_id`, `season_id` |
| `recommendation_started` | Also fired on a collection tap (with the collection's minutes/mood) | + `pick_source`, + `collection_id` when seasonal |
| `recommendation_viewed`, `game_selected`, `rec_requested`, `rec_accepted` | As today | `pick_source: 'seasonal'`, + `collection_id` |

- `pick_source` gains the value `seasonal`. `recommendation_started` gains
  `pick_source` for all sources (it lacks it today).
- Rerolls inside a collection session keep `collection_id`.
- Register `collection_id` and `season_id` as event-scoped custom dimensions in
  Firebase (Tom, console; no parentheses in display names).
- Verify in DebugView via the emulator recipe in memory/ACTIVATION-TRACKING.

## 8. Horror chip

Horror is already one of the 15 genre chips, shown only for Intense and Focused
(app `OptionalFiltersScreen.js` mood→genre map, web `App.jsx` map at L60). The
engine already returns horror at every mood (8 runs each on 2026-10-20: Casual
gave Vanishing of Ethan Carter, Year Walk, Detention; no fallbacks).

- Show Horror for **all four moods** on web and app.
- Ship web first (Vercel deploy), app in the same release as the rest.
- Acceptance: 3 runs each of Horror + every mood on web and app return
  horror-tagged games with no fallback.

## 9. Rollout

1. **API:** schema, endpoint, validation, sampling script, initial content
   (all six seasons, Harvest 2026 through Spooky 2027, §10a).
   Deploys with no app change; no client reads it yet.
2. **Web:** Horror chip for all moods.
3. **App 1.8.0:** tokens + default fixes, Seasonal card, collection sessions,
   analytics, Horror chip, bundled fallback. Device pass under the default and the
   proof season's palette (screenshots of every themed screen, before/after).
4. **Proof season live**, then build out the rest of the calendar as content PRs.

## 10. Acceptance criteria

- Collections render from `GET /api/seasonal`; with the network blocked the
  bundled fallback shows the same season.
- Setting the device date into each season shows that season's card and palette;
  a date in a gap shows neither.
- Tapping a collection shows the same three picks as the card's thumbnails, and
  they are real `/api/recommend` output for the collection params.
- A palette that fails §6.3 is rejected in CI; injected at runtime, the app shows
  the default palette.
- Default palette screens match today's screenshots except the §6.4 fixes.
- Horror + any mood returns horror games (3 runs each, web and app).
- All events in §7 fire with correct params in DebugView.

## 10a. Scope and first season (decided by Tom, 2026-10-20)

- **The full season system ships this round; Harvest 2026 (Nov 1–30) is the
  first season live.** Spooky was skipped only because it ends in 11 days.
- The content file carries all six seasons from Harvest 2026 through Spooky 2027
  (§4.1a), with palettes and collections, and the bundled fallback is a copy of
  it, so 1.8.0 rotates seasons correctly for 12 months even offline.
- Copy: Tom supplies the framing copy for every collection. To keep the release
  date, Claude drafts titles and blurbs for all collections in Tom's voice (plain,
  no em dashes) for Tom to edit and approve. Harvest copy gates the content PR;
  copy for later seasons can still be edited after release via the API file (the
  bundle only matters offline).
- **Target:** 1.8.0 submitted to both stores by about Oct 28 so it is live by
  Nov 1. A slip only shortens the proof window; nothing breaks, since older
  builds ignore `/api/seasonal`.
- **Gates for the content PR:** Tom-approved copy (Harvest at minimum), adjusted
  Harvest and Summer palettes (both fail the ΔE rule as proposed) approved by
  Tom, distinct params for every pair of concurrent collections, and a clean
  `validate_seasonal.py` run for every collection.
- 1.7.0 is still waiting on store-console steps; 1.8.0 can be built in parallel
  but must be submitted after 1.7.0 is released or rejected.

## 11. Left to the builder

- Per-file approach for converting styles (§6.1).
- Card visual design within the token rules; illustration placement.
- Exact cache durations, the client-side shape check, and test structure.
- Adjusting the starting palettes until they pass §6.3.

## 12. Related, separate work

The three scenario page drafts (long flight, holiday multiplayer, post-travel
wind-down) and their tagged links are a separate playnxt-web task, not part of
this spec. Engine sampling on 2026-10-20 found: post-travel is publishable with
house fixes; long flight needs re-picking (Palia is online-only); holiday
"couch" is false for Palia and No Man's Sky.
