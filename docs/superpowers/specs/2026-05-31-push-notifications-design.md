# Push Notifications (v1) — Design

**Date:** 2026-05-31
**Status:** Approved (pending implementation plan)
**Repo:** `ttague222/PlayNext` — `mobile-app/` (React Native + Expo SDK 54) + `api-service/` (FastAPI on Cloud Run, Firestore)

## Problem / Goal

PlayNxt has installs but near-zero retention: there is **no reason to return**. The app has no push notifications (`expo-notifications` not installed), no daily/weekly content surfacing, and no re-engagement mechanism. Meanwhile the catalog is now large and fresh (~1,086 games, including 2025–26 releases and classics) — but that content is invisible to lapsed users.

**Goal:** Re-engage users with a low-frequency, value-first push channel that respects attention (the monetization doc's core principle), works for anonymous users, and fits the existing stack with minimal new infrastructure.

## Scope (v1)

- **Weekly "what's new" broadcast** — "N new games added this week."
- **Re-engagement nudge** — for devices inactive 7–14 days.
- **Hard cap: ≤ 1 push per device per 7 days** (enforced server-side).
- **Device-based** (Expo push token per device) so anonymous users — the majority — are reachable.
- **Soft pre-prompt** before the OS permission dialog, shown once after the user's first accepted recommendation.
- **Opt-out** via a Profile toggle and OS settings.

### Out of scope (v1)
Per-user backlog reminders; per-timezone send times (fixed weekly UTC trigger); rich segmentation / A-B testing; an analytics dashboard; iOS/Android rich media notifications.

## Approach

**Expo Push Notifications + Google Cloud Scheduler → protected FastAPI endpoint.** Chosen over (a) FCM-direct via `firebase-admin` (needs manual APNs/FCM credential wiring in an Expo-managed app for no v1 benefit) and (b) a managed service like OneSignal (adds a vendor + SDK and ships device data to a third party, against the privacy ethos). Expo Push fits Expo SDK 54 + EAS, needs no APNs/FCM key management, and keeps token data self-hosted.

## Components

### 1. Mobile — `mobile-app/src/services/notificationService.js` (new)
- Add deps: `expo-notifications`, `expo-device`.
- `registerForPushNotifications()`: check `expo-device` is a physical device, request OS permission, get the Expo push token (using the EAS `projectId` `268e6152-b422-47f9-b6c3-2b6811100ba6`), and `POST /notifications/register`.
- Permission is requested **only after** the soft pre-prompt is accepted (see component 2).
- Configure the foreground notification handler and a response listener that deep-links on tap (see component 5).
- On app foreground, refresh `last_active_at` via the register endpoint (idempotent upsert).

### 2. Mobile — Soft pre-prompt
- A lightweight modal: *"Want a heads-up when we add games you'd like? About once a week, never spammy."* with Enable / Not now.
- Fires **once**, immediately after the user's **first accepted recommendation** ("I'll play this"), gated by an AsyncStorage flag `@playnxt_push_prompt_seen`.
- Hooked into the existing accept flow (the handler in `ResultsScreen` / `RecommendationContext` that records acceptance).
- "Enable" → calls `registerForPushNotifications()`. "Not now" → sets the flag; user can still enable later in Profile.

### 3. Mobile — Profile toggle
- A "Notifications" switch in `ProfileScreen`. ON → register; OFF → `POST /notifications/unregister` (sets `notifications_enabled=false`). Reflects current OS permission state.

### 4. Backend — `api-service/src/api/routes_notifications.py` (new)
Router `prefix="/notifications"`, follows existing route conventions (thin handlers, `response_model`, `get_user_id` dependency, delegates to a service).
- `POST /notifications/register` — body: `{ expo_push_token, platform }`. Upserts the device doc, sets `notifications_enabled=true`, refreshes `last_active_at`. Associates `user_id` if authenticated.
- `POST /notifications/unregister` — body: `{ expo_push_token }`. Sets `notifications_enabled=false`.
- `POST /notifications/send-weekly` — **protected** (see Security). Triggers the weekly send job; returns counts `{ digest_sent, reengagement_sent, pruned }`.

### 5. Backend — `api-service/src/services/notification_service.py` (new)
- Device CRUD on the `devices` collection.
- `build_digest()` — counts/lists games added in the last 7 days (via component 6); returns title/body, e.g. `"🎮 5 new games this week"` / `"Including Grand Theft Auto V, Hollow Knight: Silksong and more."`. If zero new games, the digest is skipped.
- `select_recipients()`:
  - **Digest** → devices with `notifications_enabled=true` AND (`last_notified_at` is null OR older than 7 days).
  - **Re-engagement** → enabled devices with `last_active_at` older than 7 days, capped the same way, **excluding** devices already receiving the digest this run.
- `send_batch(messages)` — POST to `https://exp.host/--/api/v2/push/send` in batches of 100; parse tickets.
- `handle_receipts()` / pruning — tokens returning `DeviceNotRegistered` (or invalid) are deleted from `devices`.
- After a successful send to a device, set `last_notified_at = now` (this is the cap mechanism; a scheduler double-fire cannot double-send within 7 days).

### 6. Backend — `GET /games/recent?days=7` (add to `routes_games.py`)
- Returns games with `created_at >= now - days`, newest first, as `GameSummary` items. Used by `build_digest()` and by the What's New screen.

### 7. Mobile — "What's New" screen (deep-link target)
- A minimal list screen fed by `GET /games/recent`, reusing the existing `GameCard` component. Tapping a notification deep-links here so the tap lands somewhere meaningful. Re-engagement notifications deep-link to the Play screen instead.

### 8. Infra — Google Cloud Scheduler
- One weekly job (fixed UTC time, e.g. Saturday 17:00 UTC) → authenticated `POST /notifications/send-weekly`.
- **Fallback:** a GitHub Actions scheduled workflow (cron) calling the endpoint with the shared secret, since CI/CD already runs on GitHub Actions.

## Data model — Firestore `devices` collection

| Field | Type | Notes |
|---|---|---|
| `expo_push_token` | string | Document id |
| `platform` | string | `ios` \| `android` |
| `user_id` | string \| null | Set if authenticated |
| `notifications_enabled` | bool | Profile/OS opt-out |
| `last_active_at` | datetime | Refreshed on register/foreground |
| `last_notified_at` | datetime \| null | Drives the 7-day cap |
| `created_at` | datetime | |
| `updated_at` | datetime | |

No behavioral tracking, no playtime — minimal data, consistent with the "we don't track you" stance.

## Security
- `POST /notifications/send-weekly` must reject unauthenticated callers. Primary: Cloud Scheduler with an OIDC token verified by the endpoint. Simpler alternative: a shared secret in a header (`X-Cron-Secret`) stored in Secret Manager / EAS env, compared in constant time. The plan will implement the shared-secret approach (lower setup) with OIDC noted as a hardening follow-up.
- Register/unregister are public (anonymous devices must register) but validate the token format (`ExponentPushToken[...]`).

## Error handling
- Expo API: batch in groups of 100; on per-message errors, log and continue. `DeviceNotRegistered` → delete the device doc.
- Send job is idempotent within the 7-day window via `last_notified_at`.
- Network/Expo outage → job logs failures and exits non-fatally; next week's run recovers (no retry storm).

## Testing
- **Backend unit tests** (mock the Expo Push API + Firestore):
  - `build_digest()` returns correct count/copy for N recent games; skips when zero.
  - `select_recipients()` excludes devices notified within 7 days; re-engagement targets only ≥7-day-inactive devices; no device appears in both lists in one run.
  - Invalid-token pruning deletes `DeviceNotRegistered` tokens.
- **Mobile test**: soft-prompt fires once and only after the first accepted recommendation (AsyncStorage flag gating).

## Success metrics
- Push opt-in rate (prompted → enabled), target > 35%.
- 7-day return rate among notified vs. not (the core retention signal).
- Notification open rate (deep-link opens / sends).
- Uninstall/opt-out rate after notifications (guardrail — keep low; ≤1/week cap protects this).
