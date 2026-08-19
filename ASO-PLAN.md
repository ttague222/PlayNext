# PlayNxt — App Store Optimization Plan (Video Game Discovery)

> Generated 2026-08-19. Replaces the June 2026 plan, which was written on the false premise that PlayNxt is a board game app.
>
> **Grounding:** every claim below was checked against `docs/PRD.md`, `docs/ROADMAP.md`, the shipped screens in `mobile-app/src/screens/`, and the live App Store and Google Play listings. Where the shipped app and the PRD disagree, the shipped app wins and the conflict is called out. Nothing here assumes a feature exists.

---

## 0. What PlayNxt actually is

A **decision tool for adult PC/console gamers (25–45)** who have limited time. You give it two required inputs — how much time you have and what energy you're in the mood for — and it returns **1–3 games with a written reason for each**. Optional inputs: play style, platform, solo/co-op, and a familiar-vs-surprise toggle.

Verified shipped features:

| Feature | Evidence |
|---|---|
| Time buckets: 15 / 30 / 60 / 90 / 120+ min | `TimeSelectScreen.js`, PRD §4.2 |
| Moods: Wind Down, Casual, Focused, Intense | `MoodSelectScreen.js`, PRD §4.2 |
| 1–3 recs, each with "Why this fits" | `ResultsScreen.js`, PRD §4.3 |
| Backlog / Playing / Played / Not For Me lists | `SavedGamesContext.js` `BUCKET_CONFIG` |
| Game Pass, PS Plus, EA Play awareness | Play listing; PRD §4.3 |
| PC, PlayStation, Xbox, Switch, Steam Deck | Play listing |
| No account required to get a recommendation | PRD §3.6 |
| ~1,089 game catalog | ROADMAP "Current State" |
| Free with ads; 10 rerolls/day | `adService.js`, `rerollCap.js` |
| $1.99 lifetime Premium | `ResultsScreen.js:65`, `DailyCapUpsellModal.js` |

**Not shipped — do not put in copy or screenshots:** Steam/Xbox/PSN library sync (Roadmap Phase 3), playtime tracking (explicitly excluded, PRD §8.4), social features, reviews/ratings.

---

## 1. Three defects in the live metadata

These are concrete and fixable today.

**1. The subtitle wastes ~20 of your 60 highest-weight characters.**
Live title is `PlayNxt - Game Recommendations` (30/30). Live subtitle is `Game Recommendations by Mood` (28/30). "Game Recommendations" appears in both. Apple de-duplicates across metadata fields, so the repeat earns nothing — the subtitle contributes only the new tokens `by` and `mood`. Roughly 20 characters of the second-most-weighted field in the entire listing are doing no work.

**2. The App Store description claims a feature that does not exist.**
It reads "Swipe through curated picks." There is no swipe gesture anywhere in `mobile-app/src/screens/` or `src/components/` — `ResultsScreen.js` is a `ScrollView` with a **reroll button**. This sets a false expectation at the exact moment a user decides to install, which is a review-risk and a conversion-risk. Fix the copy to say "reroll," or build the swipe. Do not leave it as-is.

**3. The Google Play category may be set to Games.**
Fetching the Play listing returned a **Games** breadcrumb. If that is the real category, PlayNxt is competing in game charts against actual games, where it will never rank and where browsing users are looking for something to play, not a tool. Apple is correctly set to **Entertainment**. *This one I could not confirm with certainty from outside — verify in Play Console before changing anything.* If it is Games, move it to Entertainment.

---

## 2. Competitive landscape (verified, video-game)

The in-store field splits into three camps, and none of them own the ground PlayNxt stands on.

| Camp | Who | What they require of the user |
|---|---|---|
| **Backlog trackers** (dominant) | Backloggr, Backlog: Video Game Organizer, GameTrack, Game Tracker, Stash, GLogs | Build and maintain a library first |
| **Picker hybrids** | NextPlay: Game Info & Picker ("IMDb for video games") | Organize games into lists first; AI "Smart Pick" beyond your own list is premium-locked ($8.99) |
| **Subscription catalog finders** | Game ID, HappyModes, Ludocene (in dev) | Browse a filtered catalog yourself |
| **First-party** | Apple Games, PlayStation App, Google Play Games | Platform-locked, editorial |

NextPlay deserves a note: it is the closest competitor in positioning (its subtitle is "Reviews, Suggestions & Tracker" and it sells an AI pick as the premium hook), but it has 3 ratings and still gates recommendations behind list-building. It validates demand for the picker framing without owning it.

**The honest read on the gap.** The trackers are not ignoring recommendation — GameTrack markets "discover what to play next," and Stash calls itself a discovery engine. So this is *not* the wide-open field the board-game plan imagined for its category. What none of them do is answer the question **cold, in under a minute, with no library and no account.** Every tracker's recommendation feature is a reward for having already done data entry.

**That is the wedge: zero setup, and time as a first-class input.** No competitor asks "how many minutes do you have?" before answering. Lead with it.

Corollary: **do not fight on `tracker`, `collection`, or `library`.** Six funded apps own those terms. Use `backlog` only as a secondary term, justified by the real Backlog/Playing/Played lists.

---

## 3. Apple — App Name (30 max)

| # | Title | Chars | Notes |
|---|---|---|---|
| **A (recommended)** | `PlayNxt: Game Finder by Mood` | 28 | "Game Finder" is the discovery phrase in the heaviest field; "by Mood" keeps continuity with the framing Apple already associates with this app |
| B | `PlayNxt: What Game to Play` | 26 | Literal user query; loses "finder" |
| C | `PlayNxt: Quick Game Finder` | 26 | "Quick" targets short-session intent but under-sells long sessions |

**Use A.**

## 4. Apple — Subtitle (30 max)

| # | Subtitle | Chars | Notes |
|---|---|---|---|
| **A (recommended)** | `What to play in your free time` | 30 | Perfect fill; adds *what, to, play, in, your, free, time* with zero overlap against Title A |
| B | `Mood and time based picks` | 25 | Wastes 5 chars, duplicates "mood" |
| C | `Pick a game for tonight` | 23 | Weaker; duplicates "game" |

**Use A.** Title A + Subtitle A index cleanly: *playnxt, game, finder, by, mood, what, to, play, in, your, free, time* — no duplicates, 58 of 60 characters working. Apple combines across fields for free, yielding "game finder," "what to play," "free time," "game by mood," and "find game by time."

## 5. Apple — Keyword field (100 max)

Rules applied: no spaces after commas, singulars only (Apple auto-matches plurals), and nothing already present in the title or subtitle.

**Paste verbatim (99/100):**
```
backlog,tracker,pick,suggest,recommend,next,steam,deck,xbox,switch,pass,indie,coop,solo,chill,short
```

- `recommend` — **must be here.** You are moving "Recommendations" out of the app name, and this is the term the listing currently ranks for. Dropping it entirely would forfeit existing equity.
- `backlog`, `tracker` — the competitor cluster. `backlog` is legitimately yours (real feature); `tracker` is a cheap 8-character bid on high-volume adjacent traffic.
- `pass`, `steam`, `deck`, `xbox`, `switch` — combine with `game` from the title to form "game pass," "steam deck," and platform phrases without paying for the second word.
- `pick`, `suggest`, `next` — recommendation-intent synonyms.
- `indie`, `coop`, `solo`, `chill`, `short` — session and mood qualifiers matching real filter values.

Deliberately excluded: `library` and `collection` (tracker-owned, unwinnable), and `games like` / similarity terms — **PlayNxt has no seed-game similarity search**, so ranking there would draw traffic the app cannot satisfy.

Worth testing later: swapping `tracker` for `ai`. The live description already markets AI picks, NextPlay bids on the same idea, and "ai game picker/finder" phrases are rising intent. `tracker` is higher volume but adjacent; `ai` is lower volume but exact. Revisit once the retitle's two-week read (§10) is in.

---

## 6. Google Play

Play indexes the full long description, so keyword weight lives there. Keep the title and short description natural — comma-stuffing is penalized.

- **Title (30):** `PlayNxt: Game Finder by Mood` (28) — parity with Apple
- **Short description (80):** `Stuck on what to play? Tell us your time and mood, get 3 picks in seconds.` (74)
  - Alt: `Your time, your mood, 3 games worth playing right now. No library setup.` (72)

---

## 7. Long description

Apple does **not** index its description — write that one purely for conversion. Play **does** index — the version below carries natural keyword density and works for both.

> **Stop scrolling. Start playing.**
> You have 40 minutes and no idea what to play. PlayNxt asks two questions and gives you up to three games worth your time, each with a clear reason why it fits right now.
> No library to build. No account required. No playtime tracking.
>
> **— How it works —**
> ◆ Pick your time: 15 minutes, 30, an hour, 90 minutes, or a long session.
> ◆ Pick your energy: Wind Down, Casual, Focused, or Intense.
> ◆ Get up to 3 games, each with "Why this game?" in plain language.
> ◆ Not feeling it? Reroll for a fresh set.
>
> **— Made for real schedules —**
> ◆ Every pick tells you its time-to-fun and whether you can quit anytime, at checkpoints, or not really.
> ◆ Optional filters for play style, platform, and solo, couch co-op, or online.
> ◆ Covers PC, PlayStation, Xbox, Nintendo Switch, and Steam Deck.
> ◆ Flags what is on Game Pass, PS Plus, and EA Play so you play what you already pay for.
>
> **— Keep track, lightly —**
> ◆ Save games to Backlog, Playing, or Played.
> ◆ Mark something Not For Me and it stops showing up.
> ◆ That is the whole system. No spreadsheets, no logging sessions, no stats to maintain.
>
> **— Free, with an optional unlock —**
> Free includes ten rerolls a day, with ads. A one-time $1.99 unlock removes ads, makes rerolls unlimited, and adds Smart History, Advanced Filters, and cross-device sync.
>
> Built by Watchlight Interactive, an indie studio. Questions or a game we should add? Reach us in-app — a real person reads it.

**Honesty check before shipping:** the "$1.99 unlock" paragraph names Smart History and Advanced Filters. Per ROADMAP, those are **backend-live but not in the shipped mobile build**. Either ship the Phase 1 build first, or cut those two names from this paragraph until you do.

---

## 8. Screenshot story (6 frames)

The single highest-leverage frame is #1 — most browsers never swipe past it.

| # | Caption overlay | Screen | Purpose |
|---|---|---|---|
| **1 (HERO)** | **"40 minutes free. Now what?"** | `ResultsScreen` with 2 game cards + visible reason text | Poses the exact problem and shows the answer in one frame |
| 2 | **"Start with your time."** | `TimeSelectScreen`, 30 min highlighted | The differentiator no competitor has. Show it early |
| 3 | **"Then your energy."** | `MoodSelectScreen`, four moods | Completes the two-tap loop; proves how little effort this takes |
| 4 | **"Every pick explains itself."** | `GameDetailScreen` — "Why this game?" plus time-to-fun and stop-friendliness badges | Builds trust and separates from algorithmic slop |
| 5 | **"Already on Game Pass."** | Game detail with subscription badge | Concrete money-saving hook; strong search-intent match |
| 6 | **"Backlog, Playing, Played. That's it."** | `BucketDetailScreen` | Answers "is this another chore app?" with no |

Design notes: portrait frames, captions ≤6 words, real catalog games with real RAWG cover art. **Do not show Smart History or Advanced Filters** until the Phase 1 build ships — the current public build does not contain that UI.

---

## 9. Promotional text (Apple, 170 max, not indexed)

Changeable anytime without review — use it for seasonal hooks.

> `Save games to Backlog, Playing and Played. Tell PlayNxt your time and mood, get up to 3 picks with a reason for each. No account needed.` (136)

---

## 10. Do these five first

1. **Fix the false "swipe" claim** in the App Store description. Smallest effort, and it is the only item here that is actively misleading users.
2. **Retitle and rewrite the subtitle** (§3, §4). Reclaims ~20 wasted characters in the highest-weight fields and moves you onto "game finder" and "what to play."
3. **Replace the Apple keyword field** with the 99-character string in §5, keeping `recommend` to protect existing ranking.
4. **Verify the Google Play category** in Play Console. If it is Games, move to Entertainment.
5. **Wire a ratings prompt.** The listing has 1 rating; below roughly 20, no metadata change can move conversion much. Trigger `expo-store-review` right after a positive "this worked for me" follow-up response (the happiest moment in the app, and the follow-up push flow is already built). Never prompt after an ad or a failed recommendation. Metadata buys impressions; ratings convert them.

**Rollout risk to watch.** Item 2 removes "Recommendations" from the app name, which is the phrase the listing ranks for today. Change Apple metadata first, hold Play at its current title, and compare impressions and conversion across the two for two weeks. If Apple drops, you have a controlled read on why and an unchanged Play listing to fall back to. Ship both only once Apple confirms.

**Then re-validate.** Everything above rests on the shipped build as of 2026-08-19. When Phase 1 lands and Smart History, Advanced Filters, and the push pre-prompt become visible, revisit §7 and §8 — that build supports claims this one cannot.

### Sources
- Backloggr — https://apps.apple.com/us/app/backloggr-video-game-tracker/id6761012462
- Backlog: Video Game Organizer — https://apps.apple.com/us/app/backlog-video-game-organizer/id6450838425
- GameTrack — https://gametrack.app/
- Game Tracker: Play & Log — https://apps.apple.com/us/app/game-tracker-play-log/id6740135016
- Game ID (subscription catalog finder) — https://apps.apple.com/mx/app/game-id/id1607800314
- NextPlay: Game Info & Picker — https://apps.apple.com/us/app/nextplay-game-database/id6760037398
- Ludocene / PS Plus discovery — https://www.pushsquare.com/news/2025/02/find-your-next-ps-plus-game-with-innovative-discovery-app
- Apple keyword field mechanics, 2026 — https://www.applaunchflow.com/blog/app-store-keyword-field-guide-2026
- Cross-field de-duplication and density — https://lexogrine.com/blog/app-store-keywords-optimization-ios-2026
- PlayNxt live listing (Apple) — https://apps.apple.com/us/app/playnxt-game-recommendations/id6757089064
- PlayNxt live listing (Play) — https://play.google.com/store/apps/details?id=com.playnxt.app
