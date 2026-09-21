# Shareable Results — Feature Spec

> Drafted 2026-09-21. Status: **proposed** — not yet scheduled.
>
> Goal: turn every good recommendation into a distribution channel. Recommendations are inherently share-shaped ("40 minutes, winding down → play Unpacking, here's why") but today they die inside the app.

## 1. What ships

A **share card**: a branded image generated on-device from a recommendation, sent through the native share sheet to Discord, Reddit, iMessage, group chats — wherever the user's gaming friends are. Every card carries the PlayNxt name and a link, so each share is organic acquisition.

v1 is entirely client-side (no new API surface). v2 adds a web landing page per shared pick once the web quiz exists.

## 2. Card design

One card = one game + the context that produced it. Contents, all already present in `GameRecommendation`:

| Element | Source |
|---|---|
| Context chips: `⏱ 40 min · 🧘 Wind Down` | the request's `time_available` + `energy_mood` |
| Game title + cover art | title + RAWG cover (already displayed in-app) |
| "Why this fits" one-liner | `explanation.summary` (truncate ~140 chars) |
| Badges | `time_to_fun`, `stop_friendliness`, subscription chips (`On Game Pass`) |
| Footer | PlayNxt wordmark + "playnxt.app" (v1: store link) |

Portrait ~1080×1350 (renders well in Discord embeds and phone chats). Dark background matching the app. **No user-identifying data on the card** — context chips only.

## 3. Implementation (v1, mobile)

- A hidden `ShareCard` component rendered off-screen with the selected recommendation, captured via `react-native-view-shot`, shared with `expo-sharing`. No server, no image hosting; the image travels with the share.
- Entry points:
  1. Share icon on each result card (`ResultsScreen`)
  2. Share button on `GameDetailScreen`
  3. Soft prompt after a "this worked for me" response — the happiest moment in the app ("Tell a friend what worked?"). Same placement philosophy as the store-review prompt; never both prompts in one session, review prompt wins.
- Share text accompanying the image: `"PlayNxt said: <title> for a <time>-minute <mood> session. <link>"` — readable even where the image is stripped.
- Structure rules per CLAUDE.md: capture/share logic in `services/shareService.js`; `ShareCard` in `components/`; screens only trigger it.

## 4. Link strategy & attribution

- **v1:** link to the store (platform-appropriate) with UTM/campaign parameters (`utm_source=share_card`). Apple App Store campaign links + Play install referrer let us count installs from shares.
- **v2 (needs web quiz page):** link to `playnxt.app/pick/<game_id>?t=40&m=wind_down` — a web page re-rendering the same card with proper OpenGraph/Twitter meta tags (link unfurls beautifully in Discord/Slack even when the image isn't attached) plus an install CTA and a "get your own pick" path into the web quiz. This is where share cards and the web quiz compound.

## 5. Analytics

Firebase events, consistent with the existing funnel names:

| Event | Params |
|---|---|
| `share_opened` | source (results/detail/worked_prompt), game_id |
| `share_completed` | share target where the OS reports it |
| `share_dismissed` | source |

North-star for the feature: installs attributed to `share_card` campaign links, and `share_opened` per 100 sessions.

## 6. Out of scope

- No social feed, profiles, or in-app community (ASO-PLAN: stay out of the tracker/social camp)
- No server-side image rendering in v1 (revisit only if platform share targets demand hosted images)
- No incentivized sharing ("share to unlock") — violates the monetization principle that features never feel like they're optimizing for us

## 7. Estimate

| Step | Scope | Est. |
|---|---|---|
| 1 | `ShareCard` component + view-shot capture + share sheet | 1–2 days |
| 2 | Entry points + analytics events | 0.5–1 day |
| 3 | Campaign-parameterized store links | 0.5 day |
| 4 (v2) | Web `/pick` landing page with OG tags | with web quiz project |
