# PlayNxt — App Store Optimization Plan

> Generated 2026-06-30. Strategic ASO pass for PlayNxt (AI board game recommendation app, live on App Store + Play Store).

## Strategic insight

In-store, every board-game **app** competitor is a **tracker/stats** app (BG Stats, Board Games Tracker, etc.). The high-intent "what board game should I play" / "board game recommendations" search is dominated by **websites**, not apps. So: **do not fight on "tracker/stats" keywords. Own "recommendation / discovery / finder / AI" intent** — it's wide open in-store. This decision drives everything below.

| Camp | Who | How they title |
|---|---|---|
| Trackers / stats | BG Stats, Board Games Tracker, BG Catalog | "Play tracking, collection management and score statistics" |
| Database / community | BoardGameGeek | brand only |
| **Recommendation (the gap)** | Quantic Foundry, Recommend.Games, BoardGamesFor.Me | almost all **web tools**, barely any native apps |

**Assumptions to validate:** (1) core loop is *answer a few prompts → get recs*, (2) it asks about player count / who you're playing with, (3) there may be a save/shortlist mechanic, (4) it does **not** yet do deep play-tracking. If it *does* track plays, add `tracker` back into the keyword field and tweak one screenshot.

---

## 1. App Title — Apple (30 char max)

| # | Title | Chars | Notes |
|---|---|---|---|
| **A (recommended)** | `PlayNxt: Board Game Finder` | 26 | "Finder" = high-intent, low-competition discovery term |
| B | `PlayNxt: What to Play Next` | 26 | Brand pun + literal user question; weaker on "board game" |
| C | `PlayNxt: Board Game Picker` | 26 | "Picker" searched less than "Finder" |

**Use A.**

## 2. Subtitle — Apple (30 char max)

| # | Subtitle | Chars | Notes |
|---|---|---|---|
| **A (recommended)** | `AI game night recommendations` | 29 | Adds "AI", "game night", "recommendations" — zero overlap with title |
| B | `AI picks your next game night` | 29 | More human; weaker keyword density |
| C | `Find the right game to play` | 27 | Adds "find/right game/play" |

**Use A.** Title A + Subtitle A index: *board, game, finder, AI, night, recommendations* — clean spread, no repeats.

## 3. Apple keyword field (100 char, comma-separated, no spaces)

Rules: no spaces after commas, no words already in title/subtitle, singulars only, synonyms + long-tail only.

**Paste verbatim (99/100):**
```
tabletop,boardgame,party,family,2 player,suggestion,quiz,picker,what,couples,strategy,group,meeple
```

- `tabletop` / `boardgame` — top synonym cluster; "boardgame" (one word) catches a spelling variant the two-word title misses.
- `party`, `family`, `2 player`, `couples`, `group`, `strategy` — use-case/audience keywords; how people actually search recommendation tools.
- `suggestion`, `picker`, `quiz`, `what` — recommendation-intent synonyms.
- `meeple` — niche hobbyist term, low competition, strong relevance signal.

Apple auto-combines fields into phrases ("board game party", "family board game", "2 player board game") for free.

## 4. Google Play

Google indexes the full long description, so keep title/short description natural (no comma stuffing).

- **Title (30):** `PlayNxt: Board Game Finder` (26) — parity with Apple
- **Short description (80):** `AI board game recommendations — tell us who's playing, get the right pick.` (73)
  - Alt: `Find your next board game in seconds. AI picks for game night, family & 2P.` (74)

## 5. Long description (first 3 lines convert)

> **Stop scrolling your shelf. PlayNxt tells you exactly what to play tonight.**
> Tell PlayNxt who's at the table and what you're in the mood for — our AI instantly recommends the right board game for your group, from quick party fillers to deep strategy.
> No more 20-minute "so… what should we play?" arguments.
>
> **— How PlayNxt works —**
> ◆ Answer a few quick questions: how many players, who's playing (family, couples, friends), how much time you have, and the vibe you want.
> ◆ Get smart, AI-powered recommendations tuned to *your* table — not just a generic top-100 list.
> ◆ Save the games you love and build a shortlist for your next game night. *(assumes a save/shortlist feature)*
>
> **— Perfect for —**
> ◆ Game nights where nobody can agree
> ◆ Couples & 2-player nights
> ◆ Family game time with mixed ages
> ◆ Discovering your next favorite beyond the same five games
>
> **— Why PlayNxt —**
> Most board game apps make you do the work — logging plays, managing spreadsheets, scrolling endless databases. PlayNxt is the opposite: you ask, it answers. It's the fastest way to go from "I don't know" to "let's play this."
>
> Built by an indie studio (Watchlight Interactive) that actually plays games. Free to download.
>
> Got feedback or a game we should know about? Reach us in-app — a real person reads it.

## 6. Screenshot story (5–6 frames, hero first)

| # | Caption overlay | What it shows | Purpose |
|---|---|---|---|
| **1 (HERO)** | **"What should we play tonight? Ask PlayNxt."** | Results screen, 2–3 recommended games as cards (cover + 1-line reason), brand teal bg | Sells the whole value prop in 2 seconds — the only frame many users see |
| 2 | **"Tell us who's playing."** | Input/quiz step — player-count + "family / couples / friends" chips | Shows low-effort loop + "tuned to your table" |
| 3 | **"AI picks the right game — and tells you why."** | Recommendation detail card with reasoning ("2 players, you like strategy, ~45 min") | Builds trust; differentiates from generic lists |
| 4 | **"From party fillers to deep strategy."** | Spread of varied game covers (party, family, 2P, strategy) | Signals breadth; hits use-case keywords visually |
| 5 | **"Save your favorites for game night."** *(if feature exists — else cut)* | Saved/shortlist screen | Shows retention value. **Drop rather than fake.** |
| 6 | **"Less debating. More playing."** | Lifestyle frame, friends/family at table, logo + "Free to download" | Emotional close + CTA |

Design: teal/green palette across all frames; captions ≤6 words; real-looking game cards; portrait phone frames.

## 7. Quick wins (do these 3 first)

1. **Re-title around "Board Game Finder" + add the AI subtitle.** Biggest lever — moves you from the crowded tracker space to the empty finder space, ranks you for "board game finder" / "AI board game" / "game night" with zero engineering.
2. **Replace the Apple keyword field with the optimized 99-char string** (§3). Reclaim characters wasted on spaces/repeats/"app"/"game".
3. **Rebuild screenshot #1 into a true hero shot** — "What should we play tonight?" over a results screen. First-screenshot conversion drives both installs and ranking.

**Validate before shipping:** confirm save/shortlist feature (affects long-desc bullet + screenshot #5) and any play-tracking.

### Sources
- BG Stats — https://www.bgstatsapp.com/
- BoardGameGeek (App Store) — https://apps.apple.com/us/app/boardgamegeek/id1559701270
- The BoardHub — https://theboardhub.app/
- BoardGamesFor.Me — http://www.boardgamesfor.me/
- Quantic Foundry recommender — https://apps.quanticfoundry.com/recommendations/tabletop/boardgame/
- SplitMetrics ASO keyword guide — https://splitmetrics.com/blog/app-store-keyword-optimization/
- Stormy AI 100-character keyword strategy — https://stormy.ai/blog/ios-app-store-keyword-field-optimization-strategy
