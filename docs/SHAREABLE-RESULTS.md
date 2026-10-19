# Shareable Results — Feature Spec

> Drafted 2026-09-21. Status: **v1 built** (same day) — ships with 1.3.0.
>
> As-built notes: the two entry points are the game detail screen and the
> post-accept celebration modal (both upgraded from the existing text-only
> share); the spec's third entry point — a share icon on each results card —
> was deliberately skipped, since the celebration modal already covers the
> results moment and the card is dense. The card is 1080×1350, captured from
> an off-screen 360×450 view via react-native-view-shot. iOS shares image +
> message together; Android shares the image via expo-sharing (the card
> itself carries the branding and store line since text can't ride along).
> Capture failure falls back to the original text share, so sharing never
> breaks. Steps below marked accordingly.
>
> Goal: turn every good recommendation into a distribution channel. Recommendations are inherently share-shaped ("40 minutes, winding down → play Unpacking, here's why") but today they die inside the app.

## 1. What ships

A **share card**: a branded image generated on-device from a recommendation, sent through the native share sheet to Discord, Reddit, iMessage, group chats — wherever the user's gaming friends are. Every card carries the PlayNxt name and a link, so each share is organic acquisition.

v1 is entirely client-side (no new API surface). v2 adds a web landing page per shared pick once the web quiz exists.

**Existing foundation:** `mobile-app/src/utils/shareGame.js` already builds a text-only share message (title + store links) for accepted games. The share card upgrades that path — `buildShareMessage` stays as the accompanying text (§3), the image rides along with it.

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

| Step | Scope | Status |
|---|---|---|
| 1 | `ShareCard` component + view-shot capture + share sheet (`services/shareService.js`) | ✅ Built |
| 2 | Entry points (detail + celebration) + share_opened/completed/dismissed analytics | ✅ Built |
| 3 | Campaign-parameterized store links (`utm_source=share_card`, Play install referrer) | ✅ Built |
| 4 (v2) | Web `/pick` landing page with OG tags | ✅ Built (`playnxt-web/api/pick.js`) |
| 5 (v3) | Web share loop: `/picks` share button, `/s/<id>`, per-sharer attribution | ✅ Built 2026-10-19 |

## 8. v3 — the web share loop (2026-10-19)

The web quiz can now share all three picks, and a shared link attributes its
opens back to the sharer.

**What ships**

- **`POST /api/shares` / `GET /api/shares/{id}`** (`api-service`): a `shares`
  Firestore collection holding the picks *as the sharer saw them* — title,
  match percentage and the "why this fits" line the engine wrote for their
  scenario. Stored rather than re-derived because re-running the engine can
  return different games, and a share must never show a game the sharer
  didn't get. Share ids are 10 chars of base62 from `secrets`.
- **Share button on `/picks`** (`playnxt-web`): one tap, no login. Uses the
  native share sheet where there is one, else copies the link. If the
  clipboard is blocked the link is shown on the page instead — the share
  already exists, so losing it would be wrong.
- **`/s/<share-id>`**: server-rendered (unfurl bots don't run JS) with the
  three picks, the scenario, OG/Twitter tags naming the real games, and a
  CTA into the quiz.
- **Attribution**: an anonymous `sharer_id` in `localStorage` rides into the
  share record; `share_open` carries `share_id` + `sharer_token`. No login, no
  personal data, no referral rewards — measurement only.

**Why the share page doesn't trust its caller**

A share link is first-party content on playnxt.io, so two things the client
sends are discarded (security review, 2026-10-19):

- **Titles come from the catalog.** `create_share` resolves every pick by
  `game_id` and rejects one that isn't in the catalog, so a caller can't put
  chosen text on a playnxt.io page. `cover_url` isn't accepted at all — the
  landing page resolves art itself — which closes the "point our page at any
  image host" hole.
- **`sharer_id` never leaves the server.** The public response carries
  `sharer_token`, an HMAC-SHA256 prefix, so attribution can still group a
  sharer's shares without handing every recipient their id (a Firebase uid,
  for app shares). A verified `user_id` beats the body's self-asserted id,
  and the stored id is namespaced `uid:` or `anon:` — without that, an
  anonymous caller could put a known uid in the body and mint that user's
  token, which is attribution forgery.
- **`SHARE_TOKEN_SALT` is required for attribution.** It's the HMAC key. With
  no key, a plain digest is a confirmation oracle (anyone holding a candidate
  id could recompute the token and prove who shared), so `sharer_token` is
  served as `null` instead. Attribution is off until the key is set; nothing
  else breaks.
- **`why` is not an input surface at all (2026-10-19).** Six rounds of review
  into filtering the caller's `why` — dot lookalikes, invisible characters,
  an inverted allowlist, a dotted-title exemption with carve-out bugs — the
  rule was replaced by the root fix the last round named: the engine now
  signs what it recommends, and the share repeats it.

  Every `GameRecommendation` carries a **pick token**
  (`services/pick_token.py`): base64url JSON of `{game, why line, match %,
  time, mood}` plus an HMAC-SHA256. The why line is the one the clients
  render first — highest-priority fit bullet, else the summary's first
  sentence — computed server-side at recommendation time. `POST /api/shares`
  takes `{game_id, pick_token}` per pick, verifies the signature *before*
  parsing the payload, and reads `why` and `match_percentage` out of the
  token. The body fields by those names no longer exist (extras are ignored,
  not read), so there is no client-owned text to filter and the whole
  link-filter apparatus is gone.

  Checks on a verified token: it must name the pick's own `game_id` and the
  share's own scenario (time + mood), or the request is a 400 — a why line
  signed for one game in one scenario can't caption anything else. Tokens are
  per pick, not per response, because a card swap leaves the final set
  spanning two engine responses; any mix verifies as long as the scenario
  matches. Dotted titles (Agar.io, Chess.com, BeamNG.drive) need no special
  case anymore: the engine wrote the text, so whatever it says is shareable.

  The key is `SHARE_TOKEN_SALT`, shared with sharer tokens but
  domain-separated by a message prefix (`pick-token-v1:`), so one production
  secret lights up both attribution and pick signing. With no key, the
  engine issues no tokens and the verifier vouches for nothing: shares still
  work but carry no why line or match — sharing never breaks, text the
  server can't vouch for just doesn't render. A *malformed or tampered*
  token, by contrast, is a 400: that's tamper evidence, not degradation.

  Residual risk: a token is a bearer record — anyone who obtained a real
  recommendation can share those exact picks with that exact text. That's
  the feature working as intended; what's gone is the ability to put chosen
  text on a playnxt.io page. The page still HTML-escapes everything it
  renders.

The landing page's inline analytics JSON is escaped for a **script** context,
not an HTML one (`</script>` in a value would close the block early), and a
share id that doesn't match the id format is dropped rather than echoed.

**App share (2026-10-19)**

- The share card now carries the scenario header and the **whole pick set**
  (up to 3, with each pick's why line and match). A single-pick share — the
  detail screen — keeps the roomier one-game layout with badges.
- Celebration shares store the picks via `POST /api/shares`
  (`surface: "app"`, each pick's signed `pick_token`) and the message links
  to `/s/<share-id>`. The API prefers the verified Firebase uid over the
  body's `sharer_id`. If the share can't be stored (API down, or no scenario
  as on the detail screen), the message falls back to the game's `/pick`
  page — sharing never breaks, and capture failure still falls back to the
  text-only share.
- `result_shared` now reports `game_count`/`num_picks` as the number of
  games the share carried.

**Incoming share links (2026-10-19)**

- iOS Universal Links (`associatedDomains: applinks:playnxt.io`) and verified
  Android App Links (https intent filter, `pathPrefix: /s/`) are declared in
  `app.config.js`, scoped to share pages only — the rest of playnxt.io stays
  in the browser. `app_open_from_share` fires with `share_id` on cold and
  warm opens (`services/deepLinkService.js`); the viewer lands on the Play
  tab, since the landing page already showed the picks and the in-app next
  step is getting your own. OAuth links pass through untouched.
- playnxt-web serves `/.well-known/apple-app-site-association` and
  `/.well-known/assetlinks.json` from env vars (`api/aasa.js`,
  `api/assetlinks.js`). Both routes **404 until `APPLE_TEAM_ID` /
  `ANDROID_CERT_SHA256` are set in Vercel** — deliberately, since the OSes
  cache these files and a wrong one fails silently. The Android value is the
  Play App Signing cert's SHA-256 (Play Console → App signing; add the
  upload key's too, comma-separated, for sideloaded builds).
- Needs a **native build + store review** to take effect (entitlement and
  intent filter are build-time); EAS manages the Associated Domains
  capability on the provisioning profile.
- `share_channel` on web is `web_share` / `copy_link` / `other` only.
- Needs `VITE_GA4_MEASUREMENT_ID` in Vercel and an `api-service` deploy.
- The `shares` collection has no retention policy yet.
- `SHARE_TOKEN_SALT` is unset by default; without it there is no
  `sharer_token` (attribution is dark) and no pick tokens (shares render
  without why lines or match percentages), so set it before launch.
