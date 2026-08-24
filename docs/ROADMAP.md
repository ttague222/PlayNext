# PlayNxt Roadmap

## Current State (as of 2026-08-24)

- **1.1.0 live on both stores** (approved 2026-08-21) — the full premium build (Smart History, Advanced Filters, push pre-prompt, What's New screen), plus ATT compliance, Firebase Analytics across the funnel, the store review prompt, and the consolidated recommendation fixes (staleness protection, Not For Me exclusion, uncapped ranking, time-affinity scoring, subscription-taxonomy bridge)
- API: consolidated engine live on Cloud Run; in-process games cache (~1,100 Firestore reads/request eliminated); SendGrid removed; `/config` POST auth-guarded; `ad_interval` raised 3→4 per review feedback
- ASO: Apple metadata updated (subtitle + keywords, title kept); Play listing intentionally held as control until ~2026-09-03
- **Catalog: 1,390 unique games** — expanded ~330 games in the 08-22→08-24 push (curated batches A–M), deduped, store-linked to a documented tail of 4, current through Aug 2026 (see Catalog Health below)
- `battlenet` store key added across API model, mobile UI, and web admin (chip renders from 1.2.0; older builds safely ignore it)
- Tests: backend 139/139, mobile jest 142/142, expo-doctor 18/18
- Release pipeline: EAS build + submit works end to end on BOTH platforms — Play service-account API verified working 2026-08-24 (test edit created/deleted), so 1.2.0 submits via `eas submit -p all`; Android upload key in three places (password manager, EAS default, local); next release must use **1.2.0 on both the ASC version label and the binary** to converge the version tracks — full checklist in `docs/runbooks/ship-1-2-0.md`

---

## Phase 0 — Security & CI Fixes (Do First)

These are blocking or high-risk items that should be resolved before any feature work.

| Item | Detail |
|------|--------|
| ~~Rotate RAWG API key~~ | ✅ Done — rotated key set as EAS env var; verified live (cover art loads in 1.1.0 builds) |
| ~~Rotate SendGrid API key~~ | Resolved 2026-08-19 by removal: no code ever read SENDGRID_API_KEY, so it was dropped from the deploy entirely and the SendGrid subscription can be cancelled. The exposed old key should still be revoked in the SendGrid dashboard before closing the account |
| ~~iOS CI credentials~~ | ✅ Done. Credentials 2026-08-19; CI platform default flipped to `all` 2026-08-20 (currently `skip` on push until EAS build quota resets Sep 1 — restore `all` then) |
| **Web Admin Deploy workflow** | Still broken — separate task to diagnose and fix GitHub Actions config |
| **API integration tests** | Pre-existing infra debt — tests red, needs Firestore emulator setup |
| ~~**Fix GitHub repo description**~~ | ✅ Done (2026-08-19). Now reads "AI-powered video game recommendations based on mood and available time" |
| ~~Delete stale local copy~~ | ✅ Done 2026-08-21 — `C:\Users\ttagu\Documents\PlayNext` deleted after keystore was secured in the password manager and on EAS |

---

## Phase 1 — Ship the Premium Build ✅ (submitted 2026-08-20)

Get the already-built features into users' hands.

**Goal:** Cut a new EAS build that includes all backend-live features. Prerequisites: iOS CI credentials resolved (or build manually once via `eas build --platform all`).

| Feature | Status |
|---------|--------|
| Premium UI (Smart History, Advanced Filters) | Backend live; mobile build pending |
| Push notification pre-prompt | Backend live; mobile build pending |
| What's New screen | Backend live; mobile build pending |
| Weekly digest (Sat 17:00 UTC) | Cloud Scheduler running; zero devices registered until users opt in after new build |

**Catalog goal:** 500+ games (currently 1,390 — nearly 3× target; future additions are demand-driven from analytics, not bulk sweeps).

---

## Post-1.1.0 Priorities (ROI-ranked 2026-08-20, reviewer signals included)

With ~23 installs, feature ROI = ratings + retention (which feed discoverability), not revenue. Two of four Play reviews are the same complaint stated twice: picks should respect the user's own games. Cheap half now, expensive half gated on data.

| Priority | Item | Cost | Why |
|---|---|---|---|
| ✅ Done 08-20 | Ad experience: `ad_interval` 3→4 (deployed; `/config` POST also auth-guarded) | Zero | Watch `ad_watched` vs retention in Firebase before tuning again |
| Deferred (Tom's call) | Affiliate links: sign up (Humble/Fanatical/GMG/GOG), flip `ENABLE_AFFILIATE_TRACKING` | Zero dev | Revenue stream on already-built UI, whenever wanted |
| ✅ Done 08-21 | Keystore backup (password manager + EAS default credential) and CI platform default | Hours | Upload key now in three places |
| ✅ Built 08-24 (ships in 1.2.0) | "Why not?" + free-tier learning from own signals | 2–4 days | Done: WhyNotModal collects rejection reasons; engine permanently excludes rejected games server-side and applies free-tier taste nudges (±0.10) from the user's own signals — no premium flag. Plus: undo toast (rejection is permanent, so misclicks need recovery), reason chips in the Not For Me list, and full modal funnel analytics (opened/reason/skip/already-played/undo). API live on deploy; UI ships with the 1.2.0 binary |
| Gated | Steam library sync (Steam only, first) | 1–2 wks | Explicitly requested by a reviewer; build only if analytics shows retention worth investing in |
| Declined | Archive/collection depth | — | Contradicts "keep track, lightly"; drifts into the tracker camp we deliberately avoid (ASO-PLAN §2) |

---

## Catalog Health ✅ (evaluation + remediation 2026-08-21; expansion + link audit 2026-08-22→24)

All five findings from the catalog evaluation fixed, then the library expanded 1,071 → **1,390** across curated batches A–M. Reusable maintenance scripts in `api-service/scripts/`, all with dry-run defaults.

**Remediation (08-21):**

| Finding | Before | After | Tool |
|---|---|---|---|
| Duplicate titles | 43 groups / 87 docs | 0 | `dedupe_games.py` (+ tombstones in `deleted_game_ids.json`, honored by `seed_from_json.py`) |
| Subscription taxonomy (premium filter broken: PS Plus matched 0 games) | drifted | server alias bridge + data normalized | alias map in `recommendation_service.py` |
| Recency | 0 games from 2026 | 27 curated 2025–26 releases added | `seed_refresh.py` + `games_data/refresh_2025_2026.json` |
| Missing `year` / store links | 304 / 186 | 0 / 4 (each of the 4 documented) | `backfill_rawg.py` + `manual_link_pass.py` |
| Dead time tags (5/10/20/45) | ~180 games | none | `normalize_time_tags.py` (ceil-to-bracket) |
| Split tag fields (genres vs genre_tags, moods vs mood_tags) | 266 docs | mirrored | `mirror_tag_fields.py` |

**Expansion (08-22→24), ~330 games net across batches A–M** (`games_data/batch_*.json`, seeded via `seed_refresh.py` with a title+id dedupe gate before every batch):

- A/B: canonical well-known library (64) · C: acclaimed (19) · D: cozy/relaxing (20) · E: multiplayer/MMO (11) · F: action/adventure deep cuts (18) · G: cross-genre essentials (28)
- **Hidden-gems push (core discovery mission):** H (33, Metacritic 78+ with low RAWG ownership), I narrative/puzzle (27), J strategy/sim (16), K action/RPG (26), L cross-genre (34), M user-rating sweep (15 — RAWG 4.1+ user score with weak/no critic coverage: Before Your Eyes, Citizen Sleeper, Symphony of the Night, Finding Paradise...)
- Sweep angles now exhausted: popularity, Metacritic-by-genre, recency, user rating. Hand-excluded throughout: dead-server, VR-only, delisted, edition/DLC noise.

**Store-link audit (08-24), `manual_link_pass.py`:** hand-verified links for 47 docs RAWG couldn't cover (iTunes/Play/Steam APIs, browser-verified PS + Battle.net URLs); deleted 9 dead/delisted titles (Clash Mini/Quest, Trivia Crack 2, Alchemy Stars, Black Clover M, Yo-kai Watch World, Picross Luna, Flappy Bird Family, a never-existed Naruto mobile doc); merged 2 batch-created duplicates (Dragon Quest XI, Hitman 3 → World of Assassination); realigned 3 docs describing wrong products. Zero-link tail: 4, each with a documented reason (2XKO Riot-only; Dreams, Cruis'n Blast underivable; Saros unreleased).

**Subscription coverage ✅ (08-24, `subscription_refresh.py`):** membership recomputed from authoritative sources — official Game Pass catalog API (console + PC sigls), PlayStation's own PS Plus Game Catalog A-Z page, and maintained Apple Arcade / Netflix Games lists (stored in `subscription_data/`). 285 docs changed: Game Pass 103→191, PS Plus 8→42, Apple Arcade 7→39, Netflix Games 4→16, including removals for games that left a service (Yakuza titles, Tetris Effect, Valheim...). Exact-match only, no fuzzy tagging. **Automated**: `subscription-refresh.yml` runs on the 3rd of each month (fetch sources → refresh Firestore → commit lists); fail-safe fetcher keeps committed lists if a source page breaks. `roles/datastore.user` granted to the deploy SA and a full manual run verified green end-to-end (08-24).

Remaining catalog debt (opportunistic): ~90 mobile games carry only one of ios/android where the other store has no listing; ea_play/ubisoft_plus/nintendo_switch_online tags are still hand-maintained (no good source list). Future additions should be **demand-driven from analytics** (thin-result filters, user searches), not further bulk sweeps. Suggested habit: monthly `seed_refresh.py` candidates + `subscription_refresh.py` runs, quarterly `dedupe_games.py`/`backfill_rawg.py` dry runs.

---

## Phase 2 — Enhanced Personalization

*From PRD §13, Phase 2*

Build on the signal history that's already being stored.

| Feature | Description |
|---------|-------------|
| **"Why not?" feature** | Tap a skipped game to see reasoning; provide negative signal |
| **Expanded preference inference** | Use accumulated `worked` / `not_good_fit` / `played_*` signals to influence ranking |
| **Configurable staleness window** | Let users adjust the 7-day deprioritization window |
| **Smart History UI** | Surface past accepted recommendations, filter by "worked before" |

---

## Phase 3 — Platform Integration

*From PRD §13, Phase 3*

Optional library syncing — never required, always optional.

| Feature | Description |
|---------|-------------|
| Steam library sync | Pull owned games; deprioritize already-played or surfaced games |
| Xbox library sync | Same pattern |
| PlayStation library sync | Same pattern |
| Game Pass / PS Plus awareness | Boost subscription-available games for subscribers |

---

## Phase 4 — Community & Social Proof

*From PRD §13, Phase 4*

Aggregate signals across users (anonymized) to add social proof to cards.

| Feature | Description |
|---------|-------------|
| Anonymous aggregate stats | "87% of users played this in 30-min sessions" |
| Curated context lists | "Best for winding down", "Best quick lunch breaks" |

---

## Monetization Phases

*Full strategy: `docs/MONETIZATION.md`*

| Phase | Model | Trigger |
|-------|-------|---------|
| **MVP (now)** | Free, no monetization | Prove retention first |
| **Premium unlock** | One-time $2.99 (or $9.99/yr) | After retention validated — show prompt only after ≥1 "this worked for me" |
| **Premium features** | Smart History, Unlimited Rerolls, Advanced Filters, Cross-Device Sync | Bundled in premium |
| **Affiliate links** | "Play on Steam / Game Pass / PS Store" | Phase 3 — never affects recommendations |
| **Enterprise/licensing** | License rec engine to storefronts or subscription services | Future, keep door open |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Recommendation acceptance rate | > 40% |
| Weekly repeat usage | > 25% |
| Reroll frequency | < 2 per session |
| "This worked for me" rate | > 60% of feedback given |
| Free → premium conversion | 3–5% |

---

## North Star

> **PlayNxt helps gamers stop deciding and start playing by delivering confident, time-aware recommendations with minimal friction.**
