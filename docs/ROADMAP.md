# PlayNxt Roadmap

## Current State (as of 2026-06-07)

- **Live** on iOS App Store + Google Play
- API: Cloud Run `playnxt-api` rev-56, all premium/history/notification endpoints live
- Mobile: EAS build is pre-premium UI — users do not yet see Smart History, Advanced Filters, push pre-prompt, or What's New screen
- Catalog: ~1,089 games validated against schema
- Tests: backend 109/109, mobile jest 100/100

---

## Phase 0 — Security & CI Fixes (Do First)

These are blocking or high-risk items that should be resolved before any feature work.

| Item | Detail |
|------|--------|
| **Rotate RAWG API key** | Old key exposed in `mobile-app/eas.json`. Regenerate at rawg.io → store as EAS Secret `EXPO_PUBLIC_RAWG_API_KEY` in Expo dashboard (PlayNxt project → Secrets) |
| **Rotate SendGrid API key** | Old key exposed in plaintext in a Cloud Run revision config. Replace: `gcloud secrets versions add SENDGRID_API_KEY --data-file=-` with fresh key from SendGrid dashboard |
| **iOS CI credentials** | EAS mobile build fails for iOS — no distribution certificate or provisioning profile for internal distribution. Fix: run `eas credentials` interactively in `mobile-app/`. Then update `.github/workflows/mobile-build.yml` line 73 platform default from `android` → `all` |
| **Web Admin Deploy workflow** | Still broken — separate task to diagnose and fix GitHub Actions config |
| **API integration tests** | Pre-existing infra debt — tests red, needs Firestore emulator setup |
| ~~**Fix GitHub repo description**~~ | ✅ Done (2026-08-19). Now reads "AI-powered video game recommendations based on mood and available time" |
| **Delete stale local copy** | `C:\Users\ttagu\Documents\PlayNext` is behind origin with no unique commits — safe to delete |

---

## Phase 1 — Ship the Premium Build

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
