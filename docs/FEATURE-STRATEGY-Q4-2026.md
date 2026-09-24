# Q4 2026 Feature Strategy — Research + Weekly Roadmap

**Written 2026-09-24** from three deep-research passes: competitor teardown, gamer pain-point research (Reddit/forums/studies), and retention/growth mechanics for small consumer apps. This doc is the PM synthesis; sequencing lives in the Weekly Plan at the bottom. `ROADMAP.md` remains the source of truth for what's shipped.

---

## 1. Strategic Picture (the one-paragraph version)

The market splits into **archivists** (people who love cataloging: Backloggd, GG, Grouvee, Infinite Backlog, HLTB, Stash all serve them) and **paralyzed players** (people who stare at a library for 30 minutes and play nothing). Nobody credible owns the paralyzed player on mobile. The only shipping product with PlayNxt's exact thesis — time + mood in, three picks out — is **SavePoint** (Two Average Gamers): web-only, $9/mo, bundled into a content-site membership. PlayNxt's combination of **native app + works-anonymously + hand-curated catalog + $1.99 one-time** is currently unduplicated. The Q4 job is to (a) deepen the moat around "tonight" before SavePoint goes mobile or GG bolts on a pick-for-me button, and (b) build the habit surface (daily ritual, widgets, smarter push) that turns a utility into a ritual.

## 2. What the Research Says

### 2.1 Pain points (demand side)

Ranked unmet needs, with the strongest evidence:

1. **"Match my energy tonight, not my aspirations."** The dominant pattern in decision-paralysis threads: people *want* to play the big RPG but don't have the focus after work. Most tools sort by genre/quality, not cognitive load. PlayNxt's energy input is aimed dead-center; the gap is depth ("brain-off", "podcast game" are native vocabulary we don't yet speak).
2. **Backlog guilt is emotional, not organizational.** A 10,000-comment Reddit analysis found 60–75% of backlog threads contain guilt/shame language; median adult backlog ~124 games vs 8–10 hrs/week. Tracking tools get abandoned as "a second unpaid job." The resonant framing is *relief and permission*, never completion. Backlog Mode should sell relief.
3. **Subscription choice overload.** "Thousands of games, I play the same 3." Game Pass/PS+ make paralysis worse. "You already pay for this" is a real hook, and nobody owns "play it before it leaves the service."
4. **Time-boxed players (parents/professionals) have hard requirements** nobody filters on: save-anywhere, pauseable, playable with sound off, one-handed, low frustration.
5. **Existing recommenders are distrusted.** Steam's queue is community-mocked ("almost entirely useless"); what satisfies people is a *contextual reason* tied to their situation — exactly our explanation format. Honest, plain-English "why" is the differentiator; protect and deepen it.
6. **Co-op/partner picking** ("co-op with my non-gamer girlfriend") is a perennial thread type nobody automates. The constraint is the less-experienced player.

Language worth stealing for ASO/marketing: *pile of shame, choice paralysis, gamer's block, brain-off games, podcast game, quit anytime, "I spend more time deciding than playing," "same 3 games in rotation," games for a new parent, one-handed games.*

### 2.2 Competitors (supply side)

| Product | Thesis | Mobile app | Price | Decision support |
|---|---|---|---|---|
| **SavePoint** | Backlog Score + "Decision Engine" (mood+time, 3 daily picks) | No (web) | $9/mo Pro | **Yes — closest threat** |
| GG (ggapp.io) | Polished native tracker | Yes | $4.99/mo | Minimal; paywall resentment |
| Backloggd | Letterboxd for games, 650K users | No (confirmed none coming) | Free/$3 Patreon | None |
| HowLongToBeat | Time-to-beat encyclopedia | No | Free | None ("a tool, not a platform") |
| Stash | Tracker + release alerts + gamified stats | Yes | Sub | None; steal the release alerts |
| Steam Discovery | Sell you new games | n/a | Free | Distrusted, purchase-oriented |
| Quantic Foundry | Motivation-profile quiz → list | No | Free | One-shot; **best onboarding pattern in the space** |
| AI wrapper wave | LLM one-shots, affiliate-monetized | Mostly no | Free | Shallow; no library, no habit |

Structural gaps no one covers: session-level "tonight" on mobile, trustworthy explanations, energy as first-class input, anonymous zero-setup value, fair one-time pricing, curation-as-feature.

### 2.3 Growth mechanics (what actually moves retention for apps our size)

- **Daily ritual + widget is the proven pair.** Wordle-style bounded daily content builds habit; an indie journaling app measured **25% higher retention among widget users** (Android Developers case study). A "Tonight's Pick" widget is the natural PlayNxt shape.
- **Personalized push beats more push.** Personalization ≈ 37% higher opens, ~4x CTR; opt-outs start at 2–5 pushes/week. Upgrade the Saturday digest's personalization and timing (Fri/Sat evening = decision time) before adding sends. Hard cap ~2/week.
- **Invisible AI wins; "AI-powered" branding loses.** The 2025–26 consumer pattern: LLM parses intent and phrases explanations, deterministic system does the ranking. Never let the model name games freeform. Cost at our scale: Haiku vibe-search ≈ $0.002/request, realistically **$1–3/month**; nightly Batch API for explanation text at 50% off. Fits the no-min-instances budget.
- **Share cards spread identity, not products.** "My gaming personality" / "My year in picks" out-shares "look at this game." 9:16 story format, one tap, 3–5 bold stats.
- **No-code store surfaces:** iOS In-App Events drive lapsed-user re-downloads (~52% re-downloads in one case study); Apple now surfaces Custom Product Pages in organic search (70 allowed); Google Play now weights retention over installs. Answer store reviews within 24–48h.
- **SEO only survives as tools.** AI Overviews cut listicle CTR 35–58%; "best cozy games under 30 minutes" earns traffic only as an interactive page backed by our real catalog ending in the quiz/app funnel.
- **Skip:** daily streaks (picking is a 2–4x/week behavior; streaks produce guilt-uninstalls), AI chat companion, Live Activities (no live state), static listicles at scale, paid UA at this scale.

Expo feasibility: Android widget via `react-native-android-widget` (config plugin, days of work, do first); iOS widget via `@bacons/expo-apple-targets` (SwiftUI, proven; the `expo-widgets` alpha is not production-safe yet); App Intents = hand-written Swift in the same target, do after iOS widget.

---

## 3. Feature Backlog (scored)

Impact/effort are relative to PlayNxt today (tiny base, solo dev, 1 release/week). "Fit" checks the PRD non-negotiables + the no-tracker, no-playtime-tracking, lean-cost constraints.

| # | Feature | Impact | Effort | Notes on fit |
|---|---|---|---|---|
| F1 | **Tonight's Picks daily ritual** — precomputed 3 picks from your last-used context, one evening push (opt-in), "just decide for me" one-tap entry | High | M (server + app) | Reframes existing max-3 output as a habit. Push at decision time (8pm local), replaces nothing, respects 2/week cap by making it opt-in |
| F2 | **Home-screen widget (Android first)** showing tonight's pick | High | S–M | Strongest retention evidence in class; Android is days of work |
| F3 | **Vibe search** — optional free-text box ("chill co-op for 2 hours with my brother") parsed by Haiku into existing filters | High | M (server-led) | Invisible AI done right: deterministic ranking unchanged, no hallucinated games, ~$1–3/mo |
| F4 | **Player-type quiz onboarding** — 2-min archetype quiz (Quantic pattern), named result, share card | High | M | Fixes anonymous cold start with heuristics, feeds explanations ("picked because you're an Explorer with 45 minutes"), most shareable asset we could build |
| F5 | **Life-fit filters** — pauseable / sound-off / one-handed / "podcast game" metadata + filter chips | Med-High | M (mostly catalog work) | Directly serves the parent/professional segment; batch-LLM-assist the tagging, hand-curate the result |
| F6 | **Release alerts** — "notify me at launch" on Coming Soon games | Med | S | Rides 1.4.0's release_date + push infra; steal from Stash |
| F7 | **Digest personalization + timing** — reference user's own moods/history, move to Fri evening, "leaving Game Pass soon" nudge | Med | S–M | Subscription-refresh diffs already detect leavers; relief framing, never homework |
| F8 | **iOS widget** (expo-apple-targets) | Med-High | M | After Android proves the surface |
| F9 | **Backlog Relief stat** — "Your next 5 evenings are already paid for" (owned + subscribed games matching tonight) | Med | S–M | SavePoint's Backlog Score inverted to relief framing per the guilt research; share-card-able; funnels Backlog Mode. NOT a tracker screen |
| F10 | **Time-to-beat on cards** — "about 3 evenings at your pace" from RAWG playtime data | Med | S | HLTB's one praised asset, phrased in sessions not hours |
| F11 | **Play-with-someone picker** — partner-skill dimension on the session-type filter | Med | M | Perennial unserved request; needs a co-op-friendliness metadata pass |
| F12 | **Share card redesign** — 9:16 identity-first format + quiz-result card | Med | S | Multiplies F4; current cards are product-first |
| F13 | **"Wrapped" — Year in Picks** (December) | Med (seasonal) | M | Built from ratings + accepted picks; December-timed release |
| F14 | **In-App Events + Custom Product Pages + review-response habit** | Med | None (no-code) | Parallel to any week; CPPs per intent ("what to play tonight," "short games," "game backlog") |
| F15 | **Slump mode / permission-to-quit** — detect repeated rerolls without acceptance, offer a palate cleanser or an honest "maybe take a break" | Med (brand) | S | Unusually honest = memorable; needs a little usage data first |
| F16 | Siri / App Intent ("What should I play tonight?") | Low-Med | M | After F8; same native target |
| F17 | Console library import (PSN/Xbox) | Med | L | Widens Backlog Mode's ceiling; defer until Steam-sync usage justifies it |

Explicitly **not doing**: streaks, AI chat companion, social feeds/friends, playtime tracking (PRD §15 privacy claim), review text at current scale (revisit note already in spec), paid UA, static SEO listicles.

## 4. Weekly Release Plan

One release a week, mixing binary releases with server/web/no-code weeks so the store cadence stays sane. 1.4.0 ships week of Sep 28 per `docs/runbooks/ship-1-4-0.md`.

| Week of | Release | Contents |
|---|---|---|
| Sep 28 | **1.4.0 ship** + no-code | Production build, device pass, submit. In parallel: Play ASO refresh (control window long over), first iOS In-App Event ("Fall releases, picked for you"), start the review-response habit |
| Oct 5 | **1.4.1 — Tonight's Picks** (F1) | Precomputed daily 3, opt-in evening reminder, one-tap "decide for me" entry on Home |
| Oct 12 | **Android widget** (F2) | Tonight's pick on the home screen; measure widget-user retention from day one |
| Oct 19 | **Vibe search** (F3) + digest upgrade (F7) | Server-led; app ships the text box. Digest gets personalization + Friday timing + leaving-subscriptions nudge |
| Oct 26 | **Player-type quiz** (F4) + share card redesign (F12) | The shareable identity asset, wired into explanations |
| Nov 2 | **iOS widget** (F8) | expo-apple-targets; reuse the Android data plumbing |
| Nov 9 | **Life-fit filters** (F5) + time-to-beat (F10) | Catalog metadata sprint + two high-demand surfaces |
| Nov 16 | **Release alerts** (F6) + Backlog Relief stat (F9) | Retention hooks riding existing infra; GTA VI launch alert lands Nov 19 |
| Nov 23 | Light week: **CPPs** (F14) + web tool page | Thanksgiving; no-code + one interactive "short games tonight" page on playnxt.io feeding the quiz |
| Dec | **Wrapped — Year in Picks** (F13), slump mode (F15) if data supports | Seasonal share moment |

Standing weekly habits (no release slot needed): answer every store review within 48h, one genuine Reddit participation/week in r/gamingsuggestions-type threads, watch `rec_accepted` / `game_rated` / digest opens to reprioritize.

## 5. Open Product Decisions

1. **Evening push vs Saturday digest cadence** — F1's evening reminder plus the Saturday digest could hit the 2/week ceiling for users who enable both. Proposal: evening reminder is opt-in and replaces nothing; revisit when open rates exist.
2. **Quiz archetypes** — needs a naming/design pass (4–6 archetypes max, heuristic mapping to mood/genre boosts). Fun brainstorm, Tom should co-write the names.
3. **Backlog Relief framing** — dollar-figure ("$1,240 of unplayed games") is attention-grabbing but guilt-adjacent; the research says relief framing retains better. Current lean: evenings-of-play framing, no dollar signs.
4. **Life-fit metadata quality bar** — LLM-assisted tagging of 1,400 games needs a curation gate like the seed pipeline's FILL_ME gate before any of it ships.
