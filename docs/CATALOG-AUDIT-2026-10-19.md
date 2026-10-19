# Game Catalog Audit — 2026-10-19

Audit of all 1407 records in the `games` Firestore collection (`playnxt-1a2c6`) for two
classes of bad record:

- **(A)** entries that are modes, editions, remasters or DLC of another entry rather than
  distinct games
- **(B)** `subscription_services` values that no longer match reality

**Status: Tier 1 of the write plan was applied on 2026-10-19 with Thomas's approval** (see
*Proposed write plan* at the end). Tiers 2 and 3 are untouched and still need decisions.
Catalog is now **1403 records**, down from 1407.

Every record touched was backed up first to
`api-service/scripts/catalog_audit_2026_10_19_backup.json` (full pre-write Firestore documents
for all six), and the four deleted ids were appended to the existing
`api-service/scripts/deleted_game_ids.json`.

---

## TL;DR

| | Finding | Records |
|---|---|---|
| A1 | Records for games that do not exist | 2 |
| A2 | Same game stored twice under two ids | 5 pairs |
| A3 | Mode / edition / DLC records to fold into a parent | 3 |
| A4 | Edition records that legitimately stand alone (no action) | 6 |
| A5 | Distinct games whose `store_links` point at a **different game** | 12 |
| B1 | `subscription_services` that are wrong today (confirmed) | 5 |
| B2 | Subscription tags missing because the title matcher is too strict | 14 candidates |
| B3 | Highest-exposure subscription claims — verified **correct** | 8 |
| C | Incidental data-quality findings | see below |

The single highest-impact fix is not in either requested class: **`harvest-moon-echoes-of-teradea`
is the most-recommended game in the entire catalog (2.6% of all recommendation slots) and has
no store links at all** — see C3.

---

## Method

Three independent passes, all read-only:

1. **Full catalog dump.** Firestore REST (`documents/games`, paged), all fields, 1407 records.
2. **Exposure measurement.** 1440 recommendation slots pulled from the production endpoint
   `POST /api/recommend` across the app's real input space — time ∈ {15, 30, 60, 90, 120}
   (from `TimeSelectScreen.js`) × mood ∈ {wind_down, casual, focused, intense} × platform ∈
   {none, pc, playstation, xbox, switch}; 480 requests, 0 errors. 234 distinct games appeared.
   Exposure is concentrated: **the top 50 games take 54% of all slots**, so verifying ~50
   records covers half of everything users actually see. This is what "blast radius" means
   below.
3. **Subscription verification.** The four managed source lists were re-fetched today with the
   existing `scripts/fetch_subscription_sources.py` (into a scratch copy — the committed lists
   in `scripts/subscription_data/` were not touched) and `subscription_refresh.py` was run in
   **dry-run** mode against production. Unmanaged services were checked separately; see B.

### Why the cheap structural heuristics were not used

Two traps were confirmed rather than assumed:

- **"Apple Arcade tag + non-Apple platforms = wrong"** is false. `unpacking` carries
  `apple_arcade` with platforms pc/playstation/xbox/switch and is **correct** — today's Apple
  Arcade list contains `Unpacking+`. Same for `hidden-folks` (`Hidden Folks+`). Both survive
  today's refresh untouched.
- **"Records sharing a store link are duplicates"** is false in both directions. An initial pass
  that stripped query strings produced a bogus 311-record "cluster" of Play Store links that are
  in fact all distinct (`?id=` is the whole identifier). After normalizing per store — Steam by
  `/app/<id>`, Play by `?id=`, App Store by `/id<n>`, others by locale-stripped path — the real
  number is **20 clusters covering 41 records**. Of those 41, only 10 are duplicate records; the
  rest are distinct games carrying a sibling's link (A5).

---

## (A) Modes, editions, remasters and DLC

### A1 — Records for games that do not exist

These are not editions of anything. No release, no store page, no coverage exists.

| id | title | evidence |
|---|---|---|
| `abzu-2` | ABZU: The Depths | Not "ABZU 2" — no such game. Giant Squid shipped ABZÛ (2016), The Pathless and Sword of the Sea — never "The Depths". A Steam app search for "ABZU" returns exactly one game, ABZÛ. The record's own Steam link is `app/384190`, which resolves to **ABZU**. Its `description_short` is `abzu`'s reworded ("Dive into…" → "Dive deeper into…"). |

> **Note on the `-2` ids:** these suffixes mean "second record for the same game", not "sequel".
> Real sequels are *kept* — see A5, where `planet-zoo-2`, `prison-architect-2`, `lost-judgment`,
> `kotor-2`, `nba-2k25`, `plants-vs-zombies-3` and `madden-nfl-26` all keep their records and
> only their store links get fixed.
| `unpacking-2` | Unpacking DLC | Not "Unpacking 2" — the `title` field is "Unpacking DLC", and Unpacking has no playable DLC. Its only Steam add-on is app 1790460, the **original soundtrack** (`type: music`, $11.99). The record claims year 2024 and "More rooms to unpack, more stories to discover"; no such content exists, and its Steam link is `app/1135690` = the **base game**. Took **2 of 1440** recommendation slots. |

**Recommendation: delete both.** Before deleting `abzu-2`, move its store links (nintendo, gog,
xbox, playstation) onto `abzu`, which currently has only a Steam link — `abzu-2` is where all of
ABZU's real links ended up.

### A2 — Same game stored twice

| ids | game | evidence | keep |
|---|---|---|---|
| `crash-4` + `crash-bandicoot-4` | Crash Bandicoot 4 | Share all three console store links | **`crash-bandicoot-4`** — its Steam id 1378990 is correct; `crash-4`'s 1378310 resolves to **"Eternal Return: Black Survival Demo"**, an unrelated game. Move `crash-4`'s `xbox_game_pass` tag across. |
| `demons-souls-2020` + `demons-souls-remake` | Demon's Souls (2020) | Identical single PlayStation link, same year | Either; `demons-souls-remake` has `franchise: souls` set |
| `dragon-ball-dokkan` + `dragon-ball-z-fighters` | Dragon Ball Z Dokkan Battle | **Identical title string**, identical iOS + Android ids | Either. `dragon-ball-z-fighters` is a misleading id for this game |
| `resident-evil-9-requiem` + `resident-evil-requiem` | Resident Evil Requiem | Same Steam app 3764200, which resolves to **"Resident Evil Requiem"** | **`resident-evil-requiem`** — the official title has no "9" |
| `marvels-spider-man` + `spider-man-remastered` | Marvel's Spider-Man | `marvels-spider-man`'s Steam link is literally `Marvels_SpiderMan_Remastered` (app 1817070). The PC release *is* Remastered; there is no separate PC SKU of the 2018 game | **`spider-man-remastered`** (3 slots vs 2) — but see note |

> Note on `marvels-spider-man`: a case can be made for keeping both, since the PS4 2018 release
> and the PS5/PC Remastered are separately purchasable on PlayStation. Flagged, not assumed.

### A3 — Mode / edition records to fold into a parent

| id | title | evidence |
|---|---|---|
| `unpacking-zen` | Unpacking Zen Mode | **The known case — see the dedicated section below** |
| `outer-wilds-archeologist` | Outer Wilds: Archaeologist Edition | A real SKU (base game + Echoes of the Eye) but not a distinct game. Identical Steam link to `outer-wilds`. Its `description_short` is strictly better than the parent's and should be kept |
| `darksiders` | Darksiders | Inverted case: the **parent** record is the problem. All four of `darksiders`' store links point at **Warmastered Edition** (Steam 462780 resolves to "Darksiders Warmastered Edition"), which is the only version sold. Fold `darksiders` into `darksiders-warmastered`, or retitle it |

### A4 — Edition records that legitimately stand alone (no action)

Flagged by the title sweep, then cleared. In each case the original is **still sold separately**
(verified live against the Steam store API), so both records are actionable for a user:

`bioshock` + `bioshock-remastered` (apps 7670 and 409710 both live) ·
`skyrim` + `skyrim-special-edition` (72850, 489830) ·
`sleeping-dogs` + `sleeping-dogs-definitive` (202170, 307690) ·
`death-stranding` + `deaths-stranding-dc` (distinct apps; note the typo in the id) ·
`portal` + `portal-companion-collection` (Switch-only bundle, the only way to buy Portal on Switch) ·
`xcom-2` + `xcom-2-collection` (mobile-only Feral port).

Two sub-notes. `shadow-of-the-colossus` (2005) and `shadow-of-the-colossus-2018` share one
PlayStation link pointing at the 2018 remake, and the PS2 original is not separately
purchasable — so this pair arguably belongs in A2, but the two records carry genuinely different
descriptions and it is left here for you to call. And `xcom-2` lists `mobile` in `platforms`
while its "ios" link is the **macOS** App Store listing (`mt=12`); that platform value is wrong.

### A5 — Distinct games pointing at the wrong game's store page

These are **not** duplicate records — each is a real, separate game. The bug is that its
`store_links` were copied from a sibling, so the "where to play" buttons send the user to buy
something else. Same evidence trail as A1–A3, and the more common failure.

| record | links point at | verified by |
|---|---|---|
| `crash-4` | Steam 1378310 = **Eternal Return: Black Survival Demo** | Steam API |
| `lost-judgment` | Steam 2058180 = **Judgment** (the first game) | Steam API |
| `nba-2k25` | Steam 2338770 = **NBA 2K24** (URL slug says 2K25; Steam resolves by id) | Steam API |
| `planet-zoo-2` | Steam 703080 = **Planet Zoo** (1). Planet Zoo 2 is real — shipped 2026-10-13 — and needs its own app id | Steam API + Frontier |
| `prison-architect-2` | all five links = **Prison Architect** (1) | Steam API |
| `kotor-2` | all six links = **KOTOR 1** | Steam API |
| `plants-vs-zombies-3` | iOS / Android / Xbox = **PvZ 1**; nintendo link is a dead `plants-vs-zombies-ds` path | — |
| `batman-arkham-knight` | nintendo link = **Arkham City** Switch. Arkham Knight was never released on Switch | — |
| `dead-space-remake` | gog / playstation / steam / xbox all = **Dead Space (2008)** | Steam API (17470) |
| `ea-fc-mobile` | iOS `id1094591345` = **Pokémon GO** | shared with the `pokemon-go` record |
| `mortal-kombat-x` | iOS + Android = **Mortal Kombat Mobile**, a different game; the `mobile` platform value is wrong as a result. 9 slots | shared with `mortal-kombat-mobile` |
| `madden-nfl-26` | Steam 1519350 = **Madden NFL 22**; the record's `year` is also 2021 | Steam API |

---

## The known case: `unpacking-zen`

**Recommendation: fold into `unpacking`, then delete the `unpacking-zen` record.** Not a plain
delete.

Why fold rather than delete outright: `unpacking-zen` holds data the parent is missing. It has
`gog` and `nintendo` store links that `unpacking` does not (the parent has only Steam), plus a
`fun_fact` and a `franchise` value. A straight delete would throw away two working store links
for a game that belongs in the catalog.

Why not keep it as its own record:

- Zen Mode is a **free mode inside Unpacking**, not a separate purchase. It shares Steam app id
  1135690 with the `unpacking` record, which resolves to "Unpacking".
- It is recommendable today and does get picked: **2 of 1440 slots** in the sweep. Across the
  Unpacking family (`unpacking` 9, `unpacking-zen` 2, `unpacking-2` 2), **4 of 13 slots — 31% —
  go to records that are not buyable games.** A user who gets `unpacking-zen` and already owns
  Unpacking is being recommended something they cannot acquire and already have.
- It also *under*-claims: `unpacking-zen` has `subscription_services: []` while `unpacking`
  correctly carries `apple_arcade`. So even on its own terms the record is wrong.
- Its `description_short` ("Zen mode removes all hints for a pure unpacking experience") is
  inaccurate — Zen Mode removes the wrong-placement restriction, not hints. Another reason not
  to preserve the text.

**Proposed writes** (both need approval):

1. `PUT /games/unpacking` — add `store_links.gog` and `store_links.nintendo` from
   `unpacking-zen`; optionally take its `fun_fact` and set `franchise: "unpacking"`.
2. `DELETE /games/unpacking-zen`.

---

## (B) Subscription accuracy

### How this is currently maintained

`.github/workflows/subscription-refresh.yml` runs on the **3rd of each month** and applies
`subscription_refresh.py --apply`, which **replaces** membership in the four managed services
(`xbox_game_pass`, `playstation_plus`, `apple_arcade`, `netflix_games`) from authoritative
source lists. `ea_play`, `ubisoft_plus` and `nintendo_switch_online` are explicitly left
untouched. Matching is exact on normalized titles, on the stated principle that *"a wrong
subscription claim is worse than a missing one."* That design is sound and the automation is
working — the findings below are its edges, not a broken system.

### Why a wrong tag matters more than it looks

`subscription_services` feeds four things, not one:

1. a hard filter — `on_subscriptions` in `recommendation_service.py` (~line 876) drops every
   game not on the user's services;
2. a ranking boost — `SUBSCRIPTION_BOOST` (~line 1069), opt-in to the user's own services
   since a65c534;
3. **the platform list shown on the game card** — `GameCard.js:425-432` derives
   `validatedPlatforms` partly from subscription config, so a wrong tag adds platforms the game
   isn't on;
4. **the shareable card** — `ShareCard.tsx:77` stamps the subscription badge onto the image
   users post publicly.

### B1 — Confirmed wrong today

Four records still claim `xbox_game_pass` for games that **left Game Pass on 2026-10-15**, after
the last refresh ran on the 3rd:

| record | exposure | current tags |
|---|---|---|
| `donut-county` | 4 / 1440 | `['xbox_game_pass']` |
| `a-plague-tale-requiem` | 0 | `['xbox_game_pass']` |
| `pacific-drive` | 0 | `['xbox_game_pass']` |
| `clair-obscur-expedition-33` | 0 | `['playstation_plus', 'xbox_game_pass']` — only the GP tag is wrong |

Two independent confirmations: (1) all four disappeared from Microsoft's own
`catalog.gamepass.com` sigl between the committed 2026-10-05 list and a fresh fetch today —
14 titles left, 10 joined, a normal mid-month rotation, so this is not a parser artifact;
(2) press coverage of the 2026-10-15 departure batch names exactly these titles alongside
Crime Scene Cleaner, Evil West, The Casting of Frank Stone and Nova Roma.

**Measured blast radius is low** in the default flow (4 slots total). It is *not* low for a
premium user filtering on `on_subscriptions`, where the claim is the whole basis of the result.

Fifth confirmed-wrong record:

| record | problem |
|---|---|
| `xdefiant` | Tagged `ubisoft_plus`. **XDefiant's servers were shut down on 2025-06-03** and it was delisted 2024-12-03; it has no offline mode, so the game cannot be played by anyone. Its only store link is a PlayStation concept page for a delisted product. This is past a subscription error — it should not be a recommendable record at all. |

**Root cause of B1:** the refresh cadence is monthly but Game Pass rotates mid-month. A
departure batch on the 15th leaves up to ~19 days of false "your subscription covers this"
claims. **Recommendation: move the cron to weekly** (`0 9 * * 1`). The job is cheap, idempotent
and already fail-safe; nothing about it assumes monthly.

### B2 — Missing tags from matcher gaps (safe direction, but lost value)

`clean()` in `subscription_refresh.py` strips trailing edition noise but has no handling for
**publisher prefixes** or several edition suffixes. So catalog titles never match their source
entries and the tag is dropped. Under-claiming is the harmless direction, but these users are
being told to buy games their subscription already covers.

Confirmed examples of the mechanism:

- `rainbow-six-siege` ("Rainbow Six Siege") vs source `"Tom Clancy's Rainbow Six® Siege - Elite Edition"`
- `the-division-2` ("The Division 2") vs source `"Tom Clancy's The Division 2"`
- `civilization-7` ("Civilization VII") vs source `"Sid Meier's Civilization VII"` — present in
  **both** the Apple Arcade and PS Plus lists today

A loose re-match (strip `Tom Clancy's` / `Sid Meier's` / `Disney's` / `Marvel's` / `EA Sports`
prefixes, and `Elite|Standard|Deluxe|Digital|… Edition`, `Xbox One`, `Xbox Series X|S`
suffixes) surfaces **14 candidates**:

```
age-of-empires-4      +xbox_game_pass      madden-25            +xbox_game_pass
civilization-7        +apple_arcade        madden-nfl-26        +xbox_game_pass
civilization-7        +playstation_plus    ori-blind-forest     +xbox_game_pass
dishonored            +xbox_game_pass      rainbow-six-siege    +xbox_game_pass
ea-fc-25              +xbox_game_pass      shadow-warrior-3     +playstation_plus
ea-sports-fc-26       +xbox_game_pass      the-division-2       +xbox_game_pass
it-takes-two          +xbox_game_pass      the-talos-principle  +playstation_plus
```

**These are review candidates, not confirmed misses** — loose matching is exactly what the
script deliberately avoids. `the-talos-principle` shows why: it matched only because
*"The Talos Principle: Deluxe Edition"* was suffix-stripped, and whether that SKU equals the
base record is a human call. **Recommendation: add prefix stripping to `clean()`** (a bounded,
exact-match-preserving change — `Tom Clancy's`, `Sid Meier's`, `Disney's`, `Marvel's`, plus the
`Xbox One` / `Xbox Series X|S` suffixes), re-run the dry run, and hand-approve the diff.

### B3 — The highest-exposure claims are correct

Of the top 50 most-recommended games (54% of all slots), eight carry a subscription tag. **All
eight match today's authoritative source lists exactly** — none appears in today's dry-run diff:

| record | slots | tags |
|---|---|---|
| `stardew-valley` | 26 | `apple_arcade` (`Stardew Valley+`), `xbox_game_pass` |
| `far-cry-5` | 18 | `xbox_game_pass` |
| `tiny-bookshop` | 15 | `xbox_game_pass` |
| `kingdom-two-crowns` | 15 | `apple_arcade` (`Kingdom Two Crowns+`), `xbox_game_pass` |
| `need-for-speed-heat` | 15 | `xbox_game_pass` |
| `into-the-breach` | 13 | `netflix_games` |
| `wylde-flowers` | 11 | `apple_arcade` |
| `burnout-paradise` | 10 | `xbox_game_pass` |

`stardew-valley` is worth calling out as the inverse of the trap: `apple_arcade` on a game with
a famous paid iOS version looks wrong, and is right — `Stardew Valley+` is on Arcade.

### The 17 unmanaged tags

`ea_play` (9), `ubisoft_plus` (6) and `nintendo_switch_online` (2) have never been
machine-checked; most were last touched 2026-05-31. Checked by hand:

- **`ea_play` — all 9 verified correct.** EA publishes no machine-readable list and
  `ea.com/ea-play/games` is JS-rendered with no titles. However, **Microsoft's catalog exposes
  EA Play as a sigl**: `b8900d09-a491-44cc-916e-32b5acae621b` ("EA Play Games") returns 96
  titles through the exact `displaycatalog` pipeline `fetch_subscription_sources.py` already
  uses. Verified against it: `f1-24`, `need-for-speed-unbound`, `star-wars-jedi-fallen-order`,
  `star-wars-jedi-survivor` and `titanfall-2` match exactly; `dead-space-remake`,
  `it-takes-two` and `madden-25` match modulo suffixes (`Dead Space`,
  `It Takes Two - Digital Version`, `Madden NFL 25 Xbox One`). **Recommendation: add this sigl
  as a fifth source and promote `ea_play` to MANAGED.** This is the cheapest high-value change
  in the audit. Caveat: the sigl is EA Play *as surfaced on Xbox*; the PC and PlayStation vaults
  are near-identical but can differ at the margin.
- **`ubisoft_plus` — 5 of 6 defensible, 1 wrong.** Ubisoft+ Classics folded into Game Pass
  Ultimate in Oct 2025, and `assassins-creed-valhalla`, `assassins-creed-mirage`,
  `riders-republic`, `rainbow-six-siege` and `the-division-2` all appear in today's Game Pass
  catalog (the first three already carry `xbox_game_pass` too). The sixth is `xdefiant` — see
  B1. Note that `ubisoft_plus` is now ambiguous between Ubisoft+ Premium and Ubisoft+ Classics,
  and arguably no longer means anything actionable on Xbox.
- **`nintendo_switch_online` — 2 records, plausible, unverified.** `ocarina-of-time` (N64 app)
  and `super-mario-bros-3` (NES app) are long-standing NSO library staples. No machine-readable
  source exists; NSO's retro libraries are append-mostly, so drift risk is low.

**Recommendation for what remains unmanaged after `ea_play` is promoted:** drop `ubisoft_plus`
as a value (it is ambiguous, and 5 of 6 are covered by `xbox_game_pass` anyway) and leave the
2 NSO tags. This follows the script's own principle — a claim nothing can verify is a claim that
will eventually be wrong.

### One source-quality note

The Apple Arcade list (Pocket Gamer, third-party — Apple publishes no API) contains three
navigation artifacts parsed as titles: `"Action games list"`, `"Adventure games list"`,
`"Card games list"`. Harmless, since they can never match a game title, but the parser is
picking up the page's category links.

---

## (C) Incidental findings

### C1 — Store link hygiene

Across all records' `store_links`:

| count | issue |
|---|---|
| 527 | `http://` rather than `https://` |
| 70 | non-US locale baked into the URL — `store.playstation.com/ru-ru/…`, `epicgames.com/store/ru/…`, `?cc=ru`, `en-gb`, `fr-fr`, `en-ca`. A US user clicking these lands on a foreign storefront |
| 35 | dead domain `marketplace.xbox.com` (retired; includes `gta-5`, `borderlands-2`, `dishonored`, `skyrim`) |
| 5 | empty-string `other` key — `minecraft`, `valorant`, `diablo-4`, `overwatch-2`, `call-of-duty-warzone` |

All four are mechanical, scriptable fixes.

### C2 — `ea-sports-fc-25` is internally inconsistent

`game_id: ea-sports-fc-25`, `title: "EA Sports FC 24"`, `year: 2023`, Steam link = FC 24
(app 2195250), tagged `ea_play`. There is a separate correct `ea-fc-25` record (app 2669320),
plus `ea-sports-fc-26` and `ea-sports-fc-27` (both verified real; FC 27 shipped 2026-09-24).
Whichever game `ea-sports-fc-25` is meant to be, the `ea_play` tag is wrong as written — FC 24
is **not** in today's EA Play list, while FC 25 and FC 26 are. Needs a decision, then a fix.

### C3 — The most-recommended game in the catalog has nowhere to play

`harvest-moon-echoes-of-teradea` took **37 of 1440 slots — 2.6% of every recommendation
served**, more than any other record. It has `store_links: {}` and `subscription_services: []`.
It released 2026-10-15, four days ago. Every user who gets this pick sees a game card with no
way to act on it.

It is not alone: 12 records have neither store links nor subscriptions — `2xko`, `bloomkeeper`,
`control-resonant`, `cruisn-blast`, `dragon-quest-monsters-withered-world`, `dreams`,
`enshrouded`, `fire-emblem-fortunes-weave`, `harvest-moon-echoes-of-teradea`,
`onimusha-way-of-the-sword`, `phantom-blade-zero`, `silent-hill-townfall`. Four appeared in the
sweep. Most are unreleased, but `cruisn-blast`, `dreams` and `enshrouded` are out.

This is worth a guardrail rather than 12 one-off fixes: **a released game with no store links
and no subscriptions has nothing for the user to do, and arguably should not be recommendable.**
It would need weighing against PRD §5.6 (the engine must never return empty results) — a filter
here has to be absorbed by the fallback hierarchy.

---

## Write plan

### Tier 1 — APPLIED 2026-10-19 (approved by Thomas)

1. ✅ Folded `unpacking-zen` into `unpacking`: added `store_links.gog` and
   `store_links.nintendo`, took its `fun_fact` ("Zen mode was added after players requested an
   even more relaxed experience."), and set `franchise: "unpacking"` — the parent had `null`
   while both child records had it set, so the base game was not participating in
   `_ensure_franchise_diversity` by its explicit field. Then deleted `unpacking-zen`.
2. ✅ Deleted `unpacking-2` ("Unpacking DLC").
3. ✅ Moved `abzu-2`'s four store links (nintendo, gog, xbox, playstation) onto `abzu`, which
   had only a Steam link, then deleted `abzu-2`.
4. ✅ Removed the stale `xbox_game_pass` tag from `donut-county`, `a-plague-tale-requiem`,
   `pacific-drive` and `clair-obscur-expedition-33` (the last keeps its correct
   `playstation_plus` tag). The refreshed source lists were copied into
   `api-service/scripts/subscription_data/` so the committed lists match what was applied —
   without that, the next dry run would propose re-adding the four stale tags.

   **Process note.** This was first done by running `subscription_refresh.py --apply`, which
   this doc offered as an equivalent route. It is **not** equivalent in scope: it also applied
   7 tag *additions* the refresh found. Those 7 were reverted to their pre-write values
   (verified against the pre-write catalog dump) within minutes, so only the 4 approved
   removals remain. Removing a false claim and adding a new one are different decisions —
   especially now that playnxt.io scenario pages read `subscription_services` from the catalog
   at render time and edge-cache it for 24h, so an addition becomes a public claim with no
   human review in between. **Do not use the `--apply` shortcut for a removal-only change.**

   The 7 additions below are correct against today's authoritative lists but are **awaiting a
   separate go-ahead** and are not applied:

   | record | addition |
   |---|---|
   | `battlefield-6` | `+xbox_game_pass` |
   | `valheim` | `+playstation_plus` |
   | `two-point-museum` | `+playstation_plus` |
   | `hell-is-us` | `+playstation_plus` |
   | `directive-8020` | `+playstation_plus` |
   | `sonic-x-shadow-generations` | `+playstation_plus` |
   | `warhammer-40000-boltgun-2` | `+playstation_plus` |
5. ✅ Deleted `xdefiant`.

**Verified after the writes**, by re-reading every touched record from `GET /api/games/{id}`:
all four deleted ids return 404; `total_games` = 1403; `unpacking` carries steam + gog +
nintendo and `abzu` carries all five stores; the four stale `xbox_game_pass` tags are gone and
`clair-obscur-expedition-33` kept its correct `playstation_plus`; the seven additions read back
at their pre-write values; and 120 fresh recommendation slots returned none of the deleted ids,
with `unpacking` still recommendable.

One note from verification: `franchise` is stored in Firestore and read at runtime by
`_ensure_franchise_diversity` (`recommendation_service.py:1337`), but it is **not** part of the
`Game` response model, so `GET /api/games/unpacking` reports `franchise: null` even though the
value is set. Pre-existing gap, unrelated to this audit.

### Tier 2 — needs a judgment call from you

6. A2 duplicate pairs: pick the survivor for `crash-*`, `demons-souls-*`, `dragon-ball-*` and
   `resident-evil-*`, and decide `marvels-spider-man` / `spider-man-remastered` and
   `shadow-of-the-colossus` / `-2018`.
7. A3: fold `outer-wilds-archeologist`; decide whether `darksiders` is retitled or folded.
8. C2: decide what `ea-sports-fc-25` is supposed to be.

### Tier 3 — code changes, separate PRs

9. Move the subscription-refresh cron from monthly to weekly. **Weigh this against the
   render-time path first:** the workflow runs `--apply` unattended, and playnxt.io scenario
   pages now read `subscription_services` from the catalog at render time (edge-cached 24h), so
   every run publishes both removals *and* additions with no human review. Weekly makes stale
   false claims much rarer, which is the win — but it also quadruples the rate of unreviewed new
   public claims. Worth considering a split: apply removals automatically on the weekly run, and
   hold additions for review (the script already computes the two directions separately).
10. Add the EA Play sigl `b8900d09-a491-44cc-916e-32b5acae621b` as a fifth source; promote
    `ea_play` to MANAGED.
11. Add publisher-prefix stripping to `clean()`; re-run the dry run and hand-approve the diff.
12. Fix the 12 A5 wrong-store-link records.
13. Mechanical link hygiene: `http://` → `https://`, strip non-US locales, replace the 35 dead
    `marketplace.xbox.com` links, drop the 5 empty `other` keys.
14. Consider a guardrail for released games with no store links and no subscriptions.

---

*Audit scripts and raw data (catalog dump, exposure counts, re-fetched source lists) were kept
in the session scratchpad; everything here is reproducible from the three passes in **Method**.*
