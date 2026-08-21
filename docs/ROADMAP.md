# PlayNxt Roadmap

## Current State (as of 2026-08-21)

- **1.1.0 in review at both stores** — the full premium build (Smart History, Advanced Filters, push pre-prompt, What's New screen), plus ATT compliance, Firebase Analytics across the funnel, the store review prompt, and the consolidated recommendation fixes (staleness protection, Not For Me exclusion, uncapped ranking, time-affinity scoring, subscription-taxonomy bridge)
- API: consolidated engine live on Cloud Run; SendGrid removed; `/config` POST now auth-guarded; `ad_interval` raised 3→4 per review feedback
- ASO: Apple metadata updated (subtitle + keywords, title kept); Play listing intentionally held as control until ~2026-09-03
- **Catalog: 1,071 unique games** — deduped, current through Aug 2026, 99% year coverage, zero dead time tags (see Catalog Health below)
- Tests: backend 136/136, mobile jest 142/142, expo-doctor 18/18
- Release pipeline: EAS build + submit works end to end on iOS; Android upload key recovered and stored in three places (local, password manager, EAS default); Play service-account grant still propagating (manual .aab upload as fallback)

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
| **Delete stale local copy** | ✅ Safe to delete now — the upload keystore is backed up in the password manager and on EAS (default build credential, 2026-08-21). `C:\Users\ttagu\Documents\PlayNext` can go whenever |

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

**Catalog goal:** 500+ games (currently ~1,089 — already beyond target; focus on quality/coverage gaps if any).

---

## Post-1.1.0 Priorities (ROI-ranked 2026-08-20, reviewer signals included)

With ~23 installs, feature ROI = ratings + retention (which feed discoverability), not revenue. Two of four Play reviews are the same complaint stated twice: picks should respect the user's own games. Cheap half now, expensive half gated on data.

| Priority | Item | Cost | Why |
|---|---|---|---|
| ✅ Done 08-20 | Ad experience: `ad_interval` 3→4 (deployed; `/config` POST also auth-guarded) | Zero | Watch `ad_watched` vs retention in Firebase before tuning again |
| Deferred (Tom's call) | Affiliate links: sign up (Humble/Fanatical/GMG/GOG), flip `ENABLE_AFFILIATE_TRACKING` | Zero dev | Revenue stream on already-built UI, whenever wanted |
| ✅ Done 08-21 | Keystore backup (password manager + EAS default credential) and CI platform default | Hours | Upload key now in three places |
| Next build | "Why not?" + free-tier learning from own signals | 2–4 days | Makes "learns from you" true for free users; answers the top review complaint cheaply |
| Gated | Steam library sync (Steam only, first) | 1–2 wks | Explicitly requested by a reviewer; build only if analytics shows retention worth investing in |
| Declined | Archive/collection depth | — | Contradicts "keep track, lightly"; drifts into the tracker camp we deliberately avoid (ASO-PLAN §2) |

---

## Catalog Health ✅ (evaluation + full remediation 2026-08-21)

All five findings from the catalog evaluation fixed in one pass. Reusable maintenance scripts in `api-service/scripts/`, all with dry-run defaults.

| Finding | Before | After | Tool |
|---|---|---|---|
| Duplicate titles | 43 groups / 87 docs | 0 | `dedupe_games.py` (+ tombstones in `deleted_game_ids.json`, honored by `seed_from_json.py`) |
| Subscription taxonomy (premium filter broken: PS Plus matched 0 games) | drifted | server alias bridge + data normalized | alias map in `recommendation_service.py` |
| Recency | 0 games from 2026 | 27 curated 2025–26 releases added; 65×2025, 21×2026 visible | `seed_refresh.py` + `games_data/refresh_2025_2026.json` |
| Missing `year` / store links | 304 / 186 | 11 / 42 (RAWG had no confident match for the rest) | `backfill_rawg.py` (fill-only, 0.90 title-similarity guard) |
| Dead time tags (5/10/20/45) | ~180 games | none | `normalize_time_tags.py` (ceil-to-bracket) |

Remaining catalog debt (opportunistic, manual): ~42 games with no store links and ~50 mobile games missing a store link where RAWG has no listing; subscription *coverage* is thin (8 PS Plus, ~105 Game Pass tagged vs hundreds in reality) — fold into the next content pass. Suggested habit: monthly `seed_refresh.py` candidates run + quarterly `dedupe_games.py`/`backfill_rawg.py` dry runs.

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
