# Tonight's Picks — Design Spec

**Date:** 2026-09-28
**Status:** Approved design, pending implementation plan
**Target release:** 1.5.0 (week of Oct 5, per `docs/FEATURE-STRATEGY-Q4-2026.md` weekly plan)
**Scope:** Mobile app only. Zero backend changes.

## 1. Summary

Tonight's Picks turns PlayNxt's on-demand recommendation flow into a daily ritual: three precomputed picks per day from the user's usual settings, surfaced as a card on the Play tab, with an optional locally scheduled evening reminder. It is the first feature of the Q4 retention plan (F1 in `FEATURE-STRATEGY-Q4-2026.md`) and deliberately produces the exact cached payload the Android home-screen widget (F2, following week) will read.

Decisions made during brainstorming (Tom, 2026-09-25 → 09-28):

1. **Ritual shape:** same 3 picks all day, cached until local midnight (Wordle-style bounded ritual).
2. **Context source:** last-used session context (time + mood + optional filters), persisted and editable; first-time users are seeded by completing the normal flow once.
3. **Reminder:** local notification, opt-in, default 8:00pm, adjustable; no server involvement.
4. **Placement:** card below the existing "What should I play?" hero CTA; core flow untouched.

## 2. Non-negotiables honored

- Time + mood are always set: Tonight's Picks *carries* the last-used values; it never omits them. The `/recommend` request is a normal request.
- Max 3 recommendations, never-empty fallback, explanations: unchanged — the existing endpoint provides all of it.
- Anonymous-capable: fully. No sign-in, no push token, no server state required.
- Lean costs: no new backend endpoints, jobs, or storage. One extra `/recommend` call per active user per day.

## 3. UX

### 3.1 Play tab card

- Hero CTA ("What should I play?") is unchanged and stays primary.
- Below it, a **Tonight's Picks** card renders only when a saved context exists (i.e., the user has completed at least one normal session). Brand-new users never see it.
- Card contents: title "Tonight's Picks", context line built from the saved context (e.g., "60 min · Wind down"), three small cover thumbnails once the day's picks are loaded, and a **Change** affordance.
- **Tap card →** Results screen showing the day's 3 picks (existing Results surface: accept, reroll, share, detail all work as today).
- **Tap Change →** the normal input flow (TimeSelect onward). Completing that flow updates the saved context AND recomputes tonight's picks for the new context (the new session's results become today's cached picks).
- States:
  - **Loading:** thumbnails show placeholder shimmer; card is tappable (Results waits on the same in-flight request).
  - **Error:** quiet inline "Couldn't load tonight's picks — tap to retry." Never blocks or degrades the hero CTA.

### 3.2 Prefetch

On Play tab mount/focus: if a saved context exists and there is no cache for today's local date, fetch picks in the background via the existing recommend API. This makes the card visually complete without user action and pre-warms the payload the reminder points at. At most one automatic fetch per local day; failures do not retry automatically until the next mount/focus.

### 3.3 Daily stability and variety

- Cache key is the **local date string** (device timezone). First successful fetch of the day wins; all later opens reuse it. Next open after midnight (or a tab focus on a new date) triggers recompute.
- Rerolls from the Results screen behave exactly as today (free-tier daily cap applies) and do **not** rewrite the day's cached three. The ritual set stays stable; reroll results are session-scoped. Exception: completing the full input flow via **Change** does rewrite the day (section 3.1).
- Day-to-day variety relies on the engine's existing 7-day shown-staleness deprioritization and the bounded randomization term. No server changes; if picks prove too repetitive in practice, revisit server-side (out of scope now).

## 4. Reminder

- **Mechanism:** `expo-notifications` locally scheduled daily notification (calendar trigger at HH:MM local). No push token, no server, works anonymously, follows the device across timezones.
- **Opt-in flow:** off by default. A one-time soft prompt shows after the user views Tonight's Picks on a **second distinct day** ("Want a nudge when tonight's picks are ready?"). Accepting requests OS notification permission if not already granted, then schedules. Declining never re-prompts; the Profile row remains available.
- **Settings:** new Profile row — toggle + time picker, default 8:00pm. Disabling cancels the scheduled notification.
- **Content:** static copy, no game titles (they may not be computed yet on-device at fire time): title "PlayNxt", body "Your picks for tonight are ready." Data payload `{ deep_link: 'tonight' }`.
- **Tap handling:** the existing `addNotificationResponseListener` wiring in `App.js` gains a `'tonight'` case → navigate to the Tonight's Picks results (triggering fetch if today's cache is empty).
- **Interaction with digest:** unchanged Saturday server digest. Worst case a user who opts into both gets one local daily + one weekly push, each separately consented.

## 5. Data & components

### 5.1 Persistence (AsyncStorage)

| Key | Shape | Written when |
|---|---|---|
| `@playnxt_last_context` | `{ time, mood, playStyle, platform, sessionType, discoveryMode }` | On every successful recommendation fetch from the **normal flow** (and via Change) |
| `@playnxt_tonights_picks` | `{ date: 'YYYY-MM-DD', context: <as above>, games: [{ id, title, coverUrl, ...card fields }] }` | On the first successful tonight-fetch of the day; overwritten by Change |
| `@playnxt_tonight_meta` | `{ viewDates: [..], promptShown: bool, reminderEnabled: bool, reminderTime: 'HH:MM' }` | View tracking for the soft prompt + reminder settings |

The `games` array stores whatever the Results screen needs to render without refetching, and is the read surface for next week's Android widget (widget will need a native-readable mirror — SharedPreferences bridge — which is **out of scope here** but the JSON shape is designed for it: keep it flat and serializable).

### 5.2 New modules

- **`src/services/tonightService.js`** — pure logic + storage: `getSavedContext()`, `saveContext(ctx)`, `getTonightsPicks({ fetchIfMissing })` (date compare, cache read/write, single-flight guard so mount + tap don't double-fetch), `recordView()` / `shouldOfferReminder()`, `setReminder(enabled, time)` (schedules/cancels via expo-notifications). No React imports.
- **`src/components/TonightCard.js`** — presentation: loading/ready/error states, thumbnails, context line, Change link. No API calls.
- **Touched:** `PlayScreen.js` (render card, prefetch on focus), `RecommendationContext.js` (persist context on successful normal-flow fetch; hydrate a results session from cached picks), `ProfileScreen.js` (reminder row), `App.js` (`'tonight'` deep-link case), `analyticsService.js` (new events).

### 5.3 Results hydration

Navigating from the card must land on Results with the cached games without a network call. The RecommendationContext gains a `startTonightSession(cachedPicks, context)` entry that seeds session state (games, context, shown-ids) exactly as a fetch would. Reroll from that session issues a normal request with the cached game ids in `excluded_game_ids` (existing behavior).

## 6. Analytics

| Event | Params | Purpose |
|---|---|---|
| `tonight_picks_viewed` | `via: 'card' \| 'notification'` | Ritual adoption |
| `tonight_reminder_prompt` | `accepted: bool` | Soft-prompt conversion |
| `tonight_reminder_set` | `enabled: bool` | Settings churn |
| existing `rec_requested` / `rec_accepted` | add `source: 'tonight' \| 'flow'` | Acceptance-rate comparison vs normal flow |

Success metrics: acceptance rate of tonight picks vs normal flow; D7 return among users who viewed the card ≥1 time vs not; reminder opt-in rate.

## 7. Edge cases

- **No saved context** → no card, no prefetch, no prompt. (Fresh installs and pre-1.5.0 upgraders are identical until their next completed session.)
- **API failure / offline** → error state on card; hero CTA unaffected; retry on tap or next focus.
- **Date rollover while app open** → next Play-tab focus recomputes (focus listener, not a timer).
- **Notification fires before any fetch that day** → tap triggers fetch with the Results loading state; cold-start latency covered by the existing 45s client timeout.
- **Reminder while permission later revoked at OS level** → scheduling call fails silently; Profile toggle reflects OS state on next visit (read permission on screen focus).
- **Premium/free** → identical feature; the daily prefetch is a request, not a reroll, and does not touch the reroll cap.
- **Unreleased games** → already excluded server-side (1.4.0); cached picks are always released titles.

## 8. Testing

- **Jest — `tonightService`:** date rollover (cache valid today, stale yesterday), single-flight fetch guard, context save/load round-trip, `shouldOfferReminder` (second distinct day, never re-prompt), reminder schedule/cancel calls (mock expo-notifications).
- **Jest — `TonightCard`:** hidden without context; loading → ready with 3 thumbnails; error state renders retry and hero CTA untouched.
- **Jest — context:** normal-flow success persists `@playnxt_last_context`; `startTonightSession` seeds a session identical to a fetch-seeded one.
- **Emulator pass (release runbook):** complete a normal session → card appears with covers → kill app, reopen → same 3 picks → tap card → Results renders without network (airplane mode check) → change date on device → new picks → enable reminder → verify scheduled notification fires and deep-links.

## 9. Out of scope (recorded so they aren't relitigated)

- Android/iOS widgets (F2/F8) — next releases; this spec only guarantees the cache shape.
- Server-side pick precomputation or personalized notification copy — revisit only if local-first proves limiting.
- "Typical evening" inferred context — YAGNI at current data volume.
- Streaks or view-count gamification — explicitly on the strategy skip list.

## 10. PRD updates (same PR as implementation)

- §4 User Flow: add Tonight's Picks entry path (carried inputs, not omitted inputs).
- §12 Notifications: add the local daily reminder (distinct from server push).
- §14 Analytics: add the new events.
