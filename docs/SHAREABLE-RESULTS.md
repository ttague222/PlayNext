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
- **`why` may not contain a link or a domain.** It's the one field a caller
  still owns, so a 422 keeps a destination off a playnxt.io page. The check
  runs on an NFKC-folded copy with dot-lookalikes translated, because NFKC
  folds U+FF0E but *not* U+3002 or U+FF61 — "evil。example" reads as a domain
  and would otherwise walk past an ASCII `\.`. Bare IPv4 is rejected too.
  Letters are matched Unicode-aware, so "café" and "Pokémon" are fine; the
  stored text is always exactly what the engine wrote. Any Unicode format
  (Cf) character — zero-width space, joiner, soft hyphen, BOM — is rejected
  outright, since those are invisible to a reader but break the label-dot
  adjacency the patterns rely on; a scan of 2354 real catalog strings found
  no Cf character at all, so the whole category is safe to refuse. Tests pin
  the bypasses and the real engine lines ("e.g.", "No. 1", an en dash) that
  must survive.

  **`why` is now an allowlist, not a denylist.** Five rounds of review each
  found another way to spell a dot or hide a character, so the rule was
  inverted: only letters (any script, by Unicode category), digits, spaces
  and plain punctuation are accepted. That rejects zero-width spaces,
  joiners, soft hyphens, the BOM, combining marks, variation selectors,
  braille blanks, emoji and every dot-lookalike in one rule instead of
  naming them one at a time. The allowed punctuation was derived from the
  corpus, not guessed: 2354 catalog strings plus the engine's own templates
  use only `.,:;!?'"()[]-/&+%`, curly quotes, en/em dashes and an ellipsis.

  **Dotted game titles are exempt.** The live catalog contains Agar.io,
  Chess.com, BeamNG.drive, Diep.io and Dirt Rally 2.0, and the engine writes
  titles into its explanations — so a naive domain rule made those games
  unshareable. The link check runs in the share service, where the
  catalog-resolved titles are known, and removes them before matching. All
  2354 catalog strings now pass both checks.

  The title exemption is anchored to token boundaries and applies only to
  titles containing a dot, because removing a title as a bare substring
  turned the exemption into a hiding place — "evilChess.com" reads as a
  domain but vanished when "Chess.com" was cut out of its middle. A
  sentence-ending period after a title is still allowed; another label
  ("Chess.com.evil") is not.

  `why` is normalised to NFC once and that form is what gets stored, so the
  text in Firestore is exactly the text the allowlist approved. Validating
  one form and storing another let a decomposed combining mark through.

  Letters that draw a *standalone* dot (sinological dot, Canadian syllabics
  middle dot, and six others) fold to "." so they are detected rather than
  rejected. That set is curated on purpose: 187 letter-category characters
  have "DOT" in their Unicode name and 179 are ordinary accented letters
  (Vietnamese ạ, Turkish İ, Irish ṡ), so a name-derived rule would have
  broken real titles. A test pins both halves of that distinction.

  Homoglyph domains need no extra rule: Cyrillic and Greek letters match the
  TLD class, so "evil.cОm" is already caught. A confusables skeleton or a
  mixed-script ban was considered and declined — no demonstrated bypass, and
  a script restriction risks rejecting legitimate titles.

  The root fix is still regenerating `why` server-side from a signed
  recommendation id; the allowlist is what makes the interim rule hold
  instead of leaking a new bypass every round.

`why` is still client-supplied — the engine writes it per request and it
exists nowhere else — so it's capped at 300 chars, link-filtered, and
HTML-escaped by the page. An abusive share could still carry 300 characters
of link-free text; that's the residual risk, and it's the price of showing
the sharer's real explanation. The proper fix is for the engine to issue a
signed recommendation id that `create_share` verifies, so `why` is read from
a server-side record instead of the request — worth doing if shares ever earn
the sharer anything.

The landing page's inline analytics JSON is escaped for a **script** context,
not an HTML one (`</script>` in a value would close the block early), and a
share id that doesn't match the id format is dropped rather than echoed.

**Known gaps**

- The app still shares **one game**, not three; the 3-pick card is not built.
- No `app_open_from_share`: the app can't receive an incoming link at all
  (no Universal Links / App Links). A share link always opens the browser.
- `share_channel` on web is `web_share` / `copy_link` / `other` only.
- Needs `VITE_GA4_MEASUREMENT_ID` in Vercel and an `api-service` deploy.
- The `shares` collection has no retention policy yet.
- `SHARE_TOKEN_SALT` is unset by default; without it there is no
  `sharer_token` at all, so set it before launch or attribution is dark.
