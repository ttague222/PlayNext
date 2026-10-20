# Seasonal collections: draft copy, params and palettes for Tom

Drafted 2026-10-20 for the 1.8.0 seasonal themes work (spec:
`docs/superpowers/specs/2026-10-20-seasonal-themes-design.md`). Everything here is
already in `api-service/src/content/seasonal.json` as a draft. Nothing merges until
you approve the Harvest copy and the two adjusted palettes (Harvest and Summer).
Later seasons can still be edited after release through the API file.

How to read this:

- **Tally** is the top 10 games from `scripts/validate_seasonal.py` against
  production, 20 unfiltered runs, 3 picks per run. The engine varies picks per
  user and per day, so the blurbs describe the kind of night, never specific games.
- **Platforms** is 5 extra runs each filtered to pc, playstation, xbox, switch and
  mobile. "All ok" means no empty run, no fallback, no failed request.
- **Contrast** numbers are WCAG ratios. The guardrail needs white on every bg stop
  at least 4.5, secondary text on the middle stop at least 4.5, brand pink on the
  lightest stop at least 3, and on-accent text on the accent at least 4.5.
  "Accent on mid" is not a guardrail rule; it shows the season accent stays
  readable as eyebrow text over the background.
- **Nearest ΔE** is the CIEDE2000 distance from the season accent to the closest
  locked mood, status or brand color. The rule is at least 12.

Full run, 2026-10-20: `VERDICT: PASS (60 samples, no empty runs, no fallback, no errors)`, exit 0.

---

## Harvest (harvest-2026), Nov 1 to Nov 30, 2026

**Palette (adjusted, needs your OK)**

| Role | Hex |
|---|---|
| accent.season | `#c87941` (copper, was `#f0a33a`) |
| onAccent.season | `#1f1300` |
| bg.gradient | `#120a06` `#2a1610` `#3a2114` (unchanged) |
| bg.decor | `#b5652e` (russet glow) |

Nearest ΔE 16.5 (Focused and warning `#f59e0b`), then 19.5 (Intense). Rating
`#fbbf24` is 25.2 away. The old amber was 3.1 from Focused/warning and 10.4 from
rating. Contrast: white min 14.92, secondary on mid 6.58, brand on lightest 4.91,
on-accent 5.44, accent on mid 5.13. The copper is also 10.8 from Spooky's orange,
so November reads as its own season after Halloween.

### Couch co-op for when everyone's over

- **id:** `harvest-2026-long-weekend`
- **Blurb:** Friends or family over and room on the couch? Games you can play together, side by side.
- **Params:** 60 min, Casual, `session_type: couch_coop`
- **Tally:** Spiritfarer 9, Sea of Stars 7, Coral Island 6, Kingdom Two Crowns 6,
  LEGO Batman: Legacy of the Dark Knight 6, Wattam 5, Chicory 3, Kirby and the
  Forgotten Land 3, Minecraft 3, Untitled Goose Game 3 (15 distinct)
- **Platforms:** all ok
- **Why it's true:** `couch_coop` is a hard filter on local co-op in the engine, so
  every pick supports playing together on one screen. The tally is gentle and
  family friendly, which suits a holiday weekend with relatives around.

---

## Winter Holidays (winter-holidays-2026), Dec 1, 2026 to Jan 7, 2027

**Palette (spec values, passes)**

| Role | Hex |
|---|---|
| accent.season | `#7cc4ff` |
| onAccent.season | `#04121f` |
| bg.gradient | `#060d1f` `#0f1e3d` `#1b2b52` |
| bg.decor | `#e8f2ff` (snow glow) |

Nearest ΔE 14.2 (Casual), then 39.0 (Wind Down). Contrast: white min 13.87,
secondary on mid 6.31, brand on lightest 4.56, on-accent 10.07, accent on mid 8.79.

### Settle in for the holiday break

- **id:** `winter-holidays-2026-break`
- **Blurb:** Nowhere to be for once. Something cozy and easygoing to sink a couple of hours into.
- **Params:** 120 min, Casual
- **Tally:** Botanicula 7, Lemon Cake 4, Tales of the Shire 4, Dragon Quest
  Builders 2 3, House Flipper 3, Littlewood 3, Wattam 3, Broken Age 2, Cattails 2,
  Garden Story 2 (30 distinct)
- **Platforms:** all ok
- **Why it's true:** the tally is low-energy life sims, builders and gentle
  adventures with long session support. "Cozy and easygoing" and "a couple of
  hours" match the 120 minute Casual params.

### Try something smaller over the break

- **id:** `winter-holidays-2026-hidden-gems`
- **Blurb:** Smaller games you might have missed, picked for a slow day off.
- **Params:** 120 min, Casual, `discovery_mode: surprise` (the differentiator)
- **Tally:** Dave the Diver 5, Spirittea 4, Wattam 4, The Pedestrian 3, The
  Touryst 3, Tiny Bookshop 3, Braid 2, Calico 2, Kingdom Two Crowns 2, Ooblets 2
  (35 distinct)
- **Platforms:** all ok
- **Why it's true:** surprise mode boosts indie games, penalizes AAA franchises and
  globally popular picks, and favors games the user hasn't interacted with. Every
  game in the tally is a smaller indie title. "Might have missed" is a soft claim
  on purpose; Dave the Diver is fairly well known.
- **Replaces** "Got new games? Play this first". See the changes section.

---

## Deep Winter (deep-winter-2027), Jan 8 to Feb 28, 2027

**Palette (spec values, passes)**

| Role | Hex |
|---|---|
| accent.season | `#a8dcf0` |
| onAccent.season | `#062030` |
| bg.gradient | `#070b14` `#101a2a` `#1b2638` |
| bg.decor | `#ffb867` (candle glow, kept from the spec) |

Nearest ΔE 14.8 (Casual), then 34.0 (success). Contrast: white min 15.21,
secondary on mid 6.67, brand on lightest 5.00, on-accent 11.27, accent on mid 11.77.

### Something gentle for the winter blues

- **id:** `deep-winter-2027-winter-blues`
- **Blurb:** Short days, long nights. Something calm and pretty to get lost in for a while.
- **Params:** 90 min, Wind Down
- **Tally:** Broken Age 5, Harvest Moon: Echoes of Teradea 5, Dragon Quest
  Builders 2 4, Coral Island 3, Eastshade 3, FAR: Lone Sails 3, Littlewood 3,
  Rakuen 3, Tales of the Shire 3, The Touryst 3 (29 distinct)
- **Platforms:** all ok
- **Why it's true:** every pick is low energy, and the mood tags lean relaxing,
  beautiful and immersive. "Calm and pretty" fits. The title was softened from
  "Beat the winter blues", which promises an outcome a game list can't promise.

### Cozy co-op for two (Feb 14 only)

- **id:** `deep-winter-2027-valentines`, window `2027-02-14` to `2027-02-14`
- **Blurb:** Grab a blanket and a second controller. Gentle games to play side by side tonight.
- **Params:** 60 min, Wind Down, `session_type: couch_coop`
- **Tally:** Kingdom Two Crowns 9, Spiritfarer 7, Chicory 6, Coral Island 6,
  BloomKeeper 4, Wattam 4, Haven 3, Kirby and the Forgotten Land 3, Minecraft 3,
  Pikmin 4 3 (17 distinct)
- **Platforms:** all ok
- **Why it's true:** local co-op is enforced by the filter, so "for two" and "a
  second controller" always hold. I moved the mood from Casual to Wind Down: in
  sampling, Wind Down brought up Coral Island, Animal Crossing, Haven and
  Spiritfarer, which fit "cozy" better than Casual's mix. It also keeps the
  Valentine's params different from Harvest's. It differs from the winter blues
  collection on time and session type, so the two never show the same games on
  Feb 14.

---

## Spring (spring-2027), Mar 1 to Apr 30, 2027

**Palette (spec values, passes)**

| Role | Hex |
|---|---|
| accent.season | `#ffa3c8` |
| onAccent.season | `#2a0716` |
| bg.gradient | `#08120d` `#11261b` `#1a3526` |
| bg.decor | `#6fcf8f` (new green) |

Nearest ΔE 15.1 (brand), then 27.5 (Intense). Contrast: white min 13.28, secondary
on mid 6.10, brand on lightest 4.37, on-accent 9.93, accent on mid 8.60.

### Fresh starts: try something new

- **id:** `spring-2027-fresh-starts`
- **Blurb:** Longer days, clearer head. A smart game you might not know yet, for one good hour.
- **Params:** 60 min, Focused, `discovery_mode: surprise`
- **Tally:** Symphony of War 5, Door Kickers 4, SteamWorld Heist 4, Cult of the
  Lamb 3, Frozen Synapse Prime 3, Monster Train 3, Pyre 3, Rhythm Doctor 3,
  Transistor 3, Wildfrost 3 (28 distinct)
- **Platforms:** all ok
- **Why it's true:** Focused gives tactics, deckbuilders and puzzle-minded games
  ("a smart game"), and surprise mode tilts toward indie titles the user hasn't
  touched ("might not know yet"). With the spec's plain Focused params, "fresh" or
  "new" would only be decoration; surprise mode makes it mean something.

---

## Summer (summer-2027), May 1 to Aug 31, 2027

**Palette (adjusted, needs your OK)**

| Role | Hex |
|---|---|
| accent.season | `#ffec94` (pale butter yellow, was `#ffd23f`) |
| onAccent.season | `#1a1400` |
| bg.gradient | `#06141c` `#0b2a3a` `#0d2f40` (unchanged) |
| bg.decor | `#ffb35c` (warm sun glow) |

Nearest ΔE 14.8 (rating `#fbbf24`), then 23.2 (Focused). The old sun yellow was
5.5 from rating. Contrast: white min 14.02, secondary on mid 5.71, brand on
lightest 4.61, on-accent 15.45, accent on mid 12.57.

I tried the sun-orange direction first. Every passing orange either lands on
Spooky's `#ff8a3d` (for example `#ff8f4a`, 1.7 from Spooky) or turns coral
(`#ff9966`, passes at 15.9 but reads salmon and is only 5.9 from Spooky). Butter
yellow keeps "sunny" and stays clearly apart from both Spooky and the rating star.
Closest failing butter: `#ffe08a` at 11.5 from rating.

### Slow summer afternoons

- **id:** `summer-2027-slow-afternoons`
- **Blurb:** Too hot to do much else? Something easygoing that's happy to fill a couple of hours.
- **Params:** 120 min, Casual (same as the holiday break collection; they are never live together)
- **Tally:** Dragon Quest Builders 2 5, Harvest Moon: Echoes of Teradea 5, Coral
  Island 4, Spirittea 4, The Pedestrian 3, Botanicula 2, Cozy Grove 2, Lemon Cake 2,
  My Time at Sandrock 2, Palia 2 (32 distinct)
- **Platforms:** all ok
- **Why it's true:** low-energy life sims and gentle puzzlers that support a two
  hour session. "Easygoing" and "a couple of hours" match.

### Start an RPG this summer

- **id:** `summer-2027-big-rpg`
- **Blurb:** You finally have the time. An RPG to sink into, one long evening at a time.
- **Params:** 120 min, Focused, `genres: ["rpg"]` (the differentiator)
- **Tally:** Titan Quest Anniversary Edition 8, Middle-earth: Shadow of Mordor 6,
  Solasta 6, Middle-earth: Shadow of War 5, Griftlands 4, Torchlight II 4, Battle
  Brothers 3, Monster Slayers 3, Transistor 3, Wasteland 3 3 (20 distinct)
- **Platforms:** all ok
- **Why it's true:** the genre filter guarantees an RPG every time, and 120 min
  Focused favors the longer, deeper ones (Solasta, Wasteland 3, Shadow of War).
  Two of the ten are shorter (Monster Slayers, Transistor), so the blurb says "to
  sink into" rather than promising a 60 hour epic.
- **Replaces** "Games for a long flight". See the changes section.

---

## Spooky (spooky-2027), Sep 1 to Oct 31, 2027

**Palette (spec values, passes)**

| Role | Hex |
|---|---|
| accent.season | `#ff8a3d` |
| onAccent.season | `#1a0b00` |
| bg.gradient | `#0d0716` `#22103a` `#2e1546` |
| bg.decor | `#ff8a3d` (pumpkin glow) |

Nearest ΔE 13.0 (Focused and warning), then 22.0 (Intense). This is the thinnest
margin of the six, but it passes. Contrast: white min 16.01, secondary on mid
6.67, brand on lightest 5.26, on-accent 8.20, accent on mid 7.44.

### Spooky games for a dark night

- **id:** `spooky-2027-scares`
- **Blurb:** Unsettling stories and strange places, the kind you play with the lights off.
- **Params:** 60 min, Casual, `genres: ["horror"]`
- **Tally:** Year Walk 16, The Vanishing of Ethan Carter 14, Bulb Boy 6,
  Detention 5, Sally Face 5, Bramble: The Mountain King 4, Stories Untold 4, Happy
  Game 3, Neverending Nightmares 2, Tiny Bunny 1 (10 distinct)
- **Platforms:** all ok
- **Why it's true:** every pick is horror tagged, and at Casual the engine returns
  atmospheric, story-led horror rather than combat-heavy survival horror. "Unsettling
  stories and strange places" describes exactly that. Worth knowing: the pool is
  small, and Year Walk and Ethan Carter show up in most runs, so the card will often
  look the same day to day. Worth adding a few horror titles to the catalog before next September.

### Cozy games for autumn evenings

- **id:** `spooky-2027-cozy-autumn`
- **Blurb:** Not in the mood for scares? Grab a warm drink and something gentle that's in no hurry.
- **Params:** 60 min, Wind Down
- **Tally:** Coral Island 6, Harvest Moon: Echoes of Teradea 6, Tales of the
  Shire 5, Lake 4, Tasomachi 4, TOEM 4, Rakuen 3, Stardew Valley 3, Wylde
  Flowers 3, Broken Age 2 (25 distinct)
- **Platforms:** all ok
- **Why it's true:** low-energy, relaxing and cozy tagged picks; same params as the
  cozy October scenario page on playnxt.io, and the blurb echoes that page's intro.

---

## Changes from the brief and why

1. **"Got new games? Play this first" is now "Try something smaller over the break".**
   The engine can't know what anyone unwrapped, so the original title promised
   something no params can deliver. Surprise mode (indie boost, AAA and popularity
   penalty, favors games the user hasn't touched) supports a "something new to you"
   hook honestly. It is also the differentiator from the holiday break collection
   (same 120 min Casual, different discovery mode).
2. **"Games for a long flight" is now "Start an RPG this summer".** A flight
   needs a portable, offline game. Collections can't set platforms or offline play,
   so a PC-only or always-online pick could show up. The RPG genre filter at 120 min
   Focused is a differentiator from "Slow summer afternoons" that the tally backs.
   I also sampled 30 min Casual (short cozy games) as a possible "quick sessions"
   collection; it was honest but felt like a weaker summer hook.
3. **Valentine's moved from Casual to Wind Down.** Cozier tally, and different
   params from Harvest.
4. **Spring gained `discovery_mode: surprise`** so "fresh starts, try something
   new" has teeth. Plain 60 min Focused was also clean (Into the Breach, Patrick's
   Parabox, Golden Idol), so dropping surprise is easy if you prefer the spec params.
5. **"Beat the winter blues" became "Something gentle for the winter blues".** Same
   params; it no longer promises a cure.
6. **"Spooky season scares" became "Spooky games for a dark night".** The Casual
   horror pool is atmospheric rather than jump-scare heavy, so the copy leans on
   mood instead of scares.
7. **Harvest accent moved from amber `#f0a33a` to copper `#c87941`**, clearing
   Focused/warning (3.1 to 16.5) and rating (10.4 to 25.2).
8. **Summer accent moved from `#ffd23f` to pale butter `#ffec94`**, clearing rating
   (5.5 to 14.8). Sun-orange options collapsed into Spooky's orange or coral.
9. **`bg.decor` picked for every season** (the spec only fixed Deep Winter's candle
   `#ffb867`): Harvest russet `#b5652e`, Winter Holidays snow `#e8f2ff`, Spring green
   `#6fcf8f`, Summer sun `#ffb35c`, Spooky pumpkin `#ff8a3d`. Decor is not
   guardrail-checked.
10. **No header images** for any season yet (no artwork).

Every pair of collections that can be visible together has different params:
holiday break vs hidden gem (discovery mode), winter blues vs Valentine's (time
and session type), summer afternoons vs big RPG (mood and genre), Spooky scares vs
cozy autumn (mood and genre).

## Tom to approve

- [x] Harvest copy: "Couch co-op for when everyone's over" and its blurb (hard gate for the content PR)
- [x] Harvest palette: copper accent `#c87941` with russet decor `#b5652e`
- [x] Summer palette: butter yellow accent `#ffec94` with sun decor `#ffb35c`
- [x] Holiday reframe: "Try something smaller over the break" instead of "Got new games? Play this first"
- [x] Summer reframe: "Start an RPG this summer" instead of "Games for a long flight"
- [x] Spring with surprise mode, or back to plain 60 min Focused
- [x] Valentine's on Wind Down instead of Casual
- [x] Copy for Winter Holidays, Deep Winter, Spring, Summer and Spooky (editable after release)
- [x] Decor colors for the five seasons the spec left open
